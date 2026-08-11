const prisma = require('../db/prisma');
const { validateTransactionPayload, amountToCents, centsToAmount } = require('./ledgerValidation');
const logger = require('../logger');

// Keep idempotency keys for 24 hours to safely deduplicate retries.
const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;

function createPayloadFingerprint(payload) {
  return JSON.stringify({
    description: payload?.description || null,
    entries: (payload?.entries || []).map(entry => ({
      accountId: entry?.accountId || null,
      amount: entry?.amount ?? null
    }))
  });
}

function getPrismaClient(options = {}) {
  return options.prismaClient || prisma;
}

function requireUserId(options = {}) {
  if (!options.userId) {
    throw new Error('Unauthorized');
  }
  return options.userId;
}

function getIdempotencyCutoff() {
  return new Date(Date.now() - IDEMPOTENCY_TTL_MS);
}

function isUniqueConstraintError(err) {
  return err && err.code === 'P2002';
}

async function getFreshIdempotencyKey(client, key, cutoff) {
  return client.idempotencyKey.findFirst({
    where: {
      key,
      createdAt: { gte: cutoff }
    }
  });
}

async function createTransaction(payload, options = {}) {
  const { description, entries } = validateTransactionPayload(payload);
  const db = getPrismaClient(options);
  const userId = requireUserId(options);
  const idempotencyKey = options.idempotencyKey && String(options.idempotencyKey).trim();
  const requestId = options.requestId || null;
  const log = options.logger || logger;
  const fingerprint = createPayloadFingerprint({ description, entries });
  const cutoff = getIdempotencyCutoff();
  const accountIds = [...new Set(entries.map(entry => entry.accountId))].sort();
  const startedAt = Date.now();

  function logAttempt(outcome, extra = {}) {
    log.info({
      requestId,
      userId,
      accountIds,
      idempotencyKey: idempotencyKey || null,
      outcome,
      durationMs: Date.now() - startedAt,
      ...extra
    }, 'transaction attempt');
  }

  if (idempotencyKey) {
    const existing = await getFreshIdempotencyKey(db, idempotencyKey, cutoff);
    if (existing) {
      if (existing.fingerprint !== fingerprint) {
        throw new Error('Idempotency key already used with a different payload');
      }
      const existingTransaction = await db.transaction.findUnique({ where: { id: existing.resultId } });
      if (!existingTransaction) {
        throw new Error('Idempotency result transaction not found');
      }
      logAttempt('success', { cached: true });
      return existingTransaction;
    }
  }

  try {
    return await db.$transaction(async (tx) => {
      // Lock rows in consistent order to prevent deadlocks
      for (const id of accountIds) {
        await tx.$queryRawUnsafe(`SELECT id FROM "Account" WHERE id = $1 FOR UPDATE`, id);
      }

      if (idempotencyKey) {
        await tx.idempotencyKey.deleteMany({ where: { createdAt: { lt: cutoff } } });

        const existing = await tx.idempotencyKey.findUnique({ where: { key: idempotencyKey } });
        if (existing) {
          if (existing.fingerprint !== fingerprint) {
            throw new Error('Idempotency key already used with a different payload');
          }

          const existingTransaction = await tx.transaction.findUnique({ where: { id: existing.resultId } });
          if (!existingTransaction) {
            throw new Error('Idempotency result transaction not found');
          }
          return existingTransaction;
        }
      }

      const ownedAccounts = await tx.account.findMany({
        where: {
          id: { in: accountIds },
          ownerId: userId
        }
      });

      if (ownedAccounts.length !== accountIds.length) {
        throw new Error('Account not found');
      }

      // Overdraft check — only asset accounts can't go negative
      for (const entry of entries) {
        const account = ownedAccounts.find(item => item.id === entry.accountId);
        if (!account) {
          throw new Error(`Account ${entry.accountId} not found`);
        }

        if (account.type === 'asset') {
          const result = await tx.entry.aggregate({
            where: { accountId: entry.accountId },
            _sum: { amount: true }
          });
          const currentBalanceCents = Math.round(Number(result._sum.amount || 0) * 100);
          const projectedCents = currentBalanceCents + amountToCents(entry.amount);
          if (projectedCents < 0) {
            throw new Error(`Insufficient funds for account ${entry.accountId}`);
          }
        }
      }

      const transaction = await tx.transaction.create({
        data: { description: description || null }
      });

      for (const entry of entries) {
        await tx.entry.create({
          data: {
            transactionId: transaction.id,
            accountId: entry.accountId,
            amount: centsToAmount(amountToCents(entry.amount))
          }
        });
      }

      if (idempotencyKey) {
        await tx.idempotencyKey.create({
          data: {
            key: idempotencyKey,
            fingerprint,
            resultId: transaction.id
          }
        });
      }

      logAttempt('success', { cached: false });
      return transaction;
    });
  } catch (err) {
    if (idempotencyKey && isUniqueConstraintError(err)) {
      const existing = await getFreshIdempotencyKey(db, idempotencyKey, cutoff);
      if (existing) {
        if (existing.fingerprint !== fingerprint) {
          throw new Error('Idempotency key already used with a different payload');
        }

        const transaction = await db.transaction.findUnique({ where: { id: existing.resultId } });
        if (!transaction) {
          throw new Error('Idempotency result transaction not found');
        }
        logAttempt('success', { cached: true, deduplicated: true });
        return transaction;
      }
    }

    logAttempt('failure', {
      error: {
        message: err.message,
        code: err.code || null
      }
    });

    throw err;
  }
}

module.exports = { createTransaction };
const prisma = require('../db/prisma');
const { validateTransactionPayload, amountToCents, centsToAmount } = require('./ledgerValidation');

const idempotencyStore = new Map();

function createPayloadFingerprint(payload) {
  return JSON.stringify({
    description: payload?.description || null,
    entries: (payload?.entries || []).map(entry => ({
      accountId: entry?.accountId || null,
      amount: entry?.amount ?? null
    }))
  });
}

async function createTransaction(payload, options = {}) {
  const { description, entries } = validateTransactionPayload(payload);
  const idempotencyKey = options.idempotencyKey && String(options.idempotencyKey).trim();

  if (idempotencyKey) {
    const existing = idempotencyStore.get(idempotencyKey);
    if (existing) {
      if (existing.fingerprint !== createPayloadFingerprint(payload)) {
        throw new Error('Idempotency key already used with a different payload');
      }
      return existing.result;
    }
  }

  const result = await prisma.$transaction(async (tx) => {
    const accountIds = [...new Set(entries.map(e => e.accountId))].sort();

    // Lock rows in consistent order to prevent deadlocks
    for (const id of accountIds) {
      await tx.$queryRawUnsafe(`SELECT id FROM "Account" WHERE id = $1 FOR UPDATE`, id);
    }

    // Overdraft check — only asset accounts can't go negative
    for (const entry of entries) {
      const account = await tx.account.findUnique({ where: { id: entry.accountId } });
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

    return transaction;
  });

  if (idempotencyKey) {
    idempotencyStore.set(idempotencyKey, {
      fingerprint: createPayloadFingerprint(payload),
      result
    });
  }

  return result;
}

module.exports = { createTransaction };
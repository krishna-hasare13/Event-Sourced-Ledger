const prisma = require('../db/prisma');
const { parseAsOfDate } = require('./ledgerValidation');

const VALID_TYPES = ['asset', 'liability', 'equity', 'credit'];

function getPrismaClient(options = {}) {
  return options.prismaClient || prisma;
}

function requireUserId(options = {}) {
  if (!options.userId) {
    throw new Error('Unauthorized');
  }
  return options.userId;
}

async function createAccount({ name, type }, options = {}) {
  const db = getPrismaClient(options);
  const userId = requireUserId(options);

  if (!name || typeof name !== 'string' || !name.trim()) {
    throw new Error('Account name is required');
  }
  if (!VALID_TYPES.includes(type)) {
    throw new Error(`Account type must be one of: ${VALID_TYPES.join(', ')}`);
  }
  return db.account.create({ data: { name: name.trim(), type, ownerId: userId } });
}

async function listAccounts(options = {}) {
  const db = getPrismaClient(options);
  const userId = requireUserId(options);
  const limit = Math.min(Math.max(Number(options.limit) || 25, 1), 100);
  const cursor = options.cursor ? new Date(options.cursor) : null;

  if (cursor && Number.isNaN(cursor.getTime())) {
    throw new Error('cursor must be a valid date');
  }

  const items = await db.account.findMany({
    where: {
      ownerId: userId,
      ...(cursor ? { createdAt: { gt: cursor } } : {})
    },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    take: limit + 1
  });

  const hasMore = items.length > limit;
  const pageItems = hasMore ? items.slice(0, limit) : items;

  return {
    items: pageItems,
    nextCursor: hasMore ? pageItems[pageItems.length - 1].createdAt.toISOString() : null
  };
}

async function getAccountById(id, options = {}) {
  const db = getPrismaClient(options);
  const userId = requireUserId(options);

  const account = await db.account.findFirst({ where: { id, ownerId: userId } });
  if (!account) throw new Error('Account not found');
  return account;
}

async function getBalance(accountId, asOf = null, options = {}) {
  const db = getPrismaClient(options);
  await getAccountById(accountId, options); // throws if the account doesn't exist or isn't owned

  const parsedAsOf = parseAsOfDate(asOf);
  const where = { accountId };
  if (parsedAsOf) where.createdAt = { lte: parsedAsOf };

  const result = await db.entry.aggregate({ where, _sum: { amount: true } });
  return Number(result._sum.amount || 0);
}

module.exports = { createAccount, listAccounts, getAccountById, getBalance };
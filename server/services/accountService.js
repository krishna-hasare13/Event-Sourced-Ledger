const prisma = require('../db/prisma');
const { parseAsOfDate } = require('./ledgerValidation');

const VALID_TYPES = ['asset', 'liability', 'equity', 'credit'];

async function createAccount({ name, type }) {
  if (!name || typeof name !== 'string' || !name.trim()) {
    throw new Error('Account name is required');
  }
  if (!VALID_TYPES.includes(type)) {
    throw new Error(`Account type must be one of: ${VALID_TYPES.join(', ')}`);
  }
  return prisma.account.create({ data: { name: name.trim(), type } });
}

async function listAccounts() {
  return prisma.account.findMany({ orderBy: { createdAt: 'asc' } });
}

async function getAccountById(id) {
  const account = await prisma.account.findUnique({ where: { id } });
  if (!account) throw new Error('Account not found');
  return account;
}

async function getBalance(accountId, asOf = null) {
  await getAccountById(accountId); // throws if account doesn't exist

  const parsedAsOf = parseAsOfDate(asOf);
  const where = { accountId };
  if (parsedAsOf) where.createdAt = { lte: parsedAsOf };

  const result = await prisma.entry.aggregate({ where, _sum: { amount: true } });
  return Number(result._sum.amount || 0);
}

module.exports = { createAccount, listAccounts, getAccountById, getBalance };
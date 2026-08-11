const prisma = require('../db/prisma');
const { getAccountById } = require('./accountService');

async function getAuditTrail(accountId, options = {}) {
  const db = options.prismaClient || prisma;
  await getAccountById(accountId, options); // throws if not found or not owned
  const limit = Math.min(Math.max(Number(options.limit) || 50, 1), 100);
  const cursor = options.cursor ? new Date(options.cursor) : null;

  if (cursor && Number.isNaN(cursor.getTime())) {
    throw new Error('cursor must be a valid date');
  }

  const count = await db.entry.count({ where: { accountId } });
  const balanceResult = await db.entry.aggregate({ where: { accountId }, _sum: { amount: true } });
  const finalBalance = Number(balanceResult._sum.amount || 0);

  const startingBalanceResult = cursor
    ? await db.entry.aggregate({
        where: {
          accountId,
          createdAt: { lte: cursor }
        },
        _sum: { amount: true }
      })
    : { _sum: { amount: 0 } };

  const startingBalance = Number(startingBalanceResult._sum.amount || 0);

  const entries = await db.entry.findMany({
    where: {
      accountId,
      ...(cursor ? { createdAt: { gt: cursor } } : {})
    },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    take: limit + 1,
    include: { transaction: true }
  });

  const hasMore = entries.length > limit;
  const pageEntries = hasMore ? entries.slice(0, limit) : entries;
  let runningBalance = 0;
  let balanceBeforePage = startingBalance;
  const trail = pageEntries.map(entry => {
    const amount = Number(entry.amount);
    balanceBeforePage += amount;
    runningBalance = balanceBeforePage;
    return {
      entryId: entry.id,
      transactionId: entry.transactionId,
      description: entry.transaction.description,
      amount,
      runningBalance,
      timestamp: entry.createdAt,
      explanation: `${amount >= 0 ? 'Credited' : 'Debited'} ${Math.abs(amount)} — "${entry.transaction.description}" — balance became ${runningBalance}`
    };
  });

  return { accountId, finalBalance, entryCount: count, trail, nextCursor: hasMore ? pageEntries[pageEntries.length - 1].createdAt.toISOString() : null };
}

module.exports = { getAuditTrail };
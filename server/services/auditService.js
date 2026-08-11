const prisma = require('../db/prisma');
const { getAccountById } = require('./accountService');

async function getAuditTrail(accountId) {
  await getAccountById(accountId); // throws if not found

  const entries = await prisma.entry.findMany({
    where: { accountId },
    orderBy: { createdAt: 'asc' },
    include: { transaction: true }
  });

  let runningBalance = 0;
  const trail = entries.map(entry => {
    const amount = Number(entry.amount);
    runningBalance += amount;
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

  return { accountId, finalBalance: runningBalance, entryCount: trail.length, trail };
}

module.exports = { getAuditTrail };
const { getAuditTrail } = require('../services/auditService');

function createPrismaClient() {
  const state = {
    account: { id: 'acc-1', ownerId: 'user-1', type: 'asset' },
    entries: [
      {
        id: 'entry-1',
        transactionId: 'tx-1',
        accountId: 'acc-1',
        amount: 10,
        createdAt: new Date('2026-07-29T10:00:00.000Z'),
        transaction: { description: 'Deposit' }
      },
      {
        id: 'entry-2',
        transactionId: 'tx-2',
        accountId: 'acc-1',
        amount: -4,
        createdAt: new Date('2026-07-30T10:00:00.000Z'),
        transaction: { description: 'Withdrawal' }
      }
    ]
  };

  return {
    account: {
      findFirst: jest.fn(async ({ where }) => {
        if (where.id !== state.account.id) return null;
        if (where.ownerId !== state.account.ownerId) return null;
        return state.account;
      })
    },
    entry: {
      count: jest.fn(async () => state.entries.length),
      aggregate: jest.fn(async ({ where }) => {
        const entries = state.entries.filter(entry => {
          if (where.accountId && entry.accountId !== where.accountId) return false;
          if (where.createdAt?.lte && entry.createdAt > where.createdAt.lte) return false;
          return true;
        });
        const total = entries.reduce((sum, entry) => sum + Number(entry.amount), 0);
        return { _sum: { amount: total } };
      }),
      findMany: jest.fn(async () => state.entries)
    }
  };
}

describe('audit service', () => {
  test('returns a running balance and explanation text', async () => {
    const prisma = createPrismaClient();
    const result = await getAuditTrail('acc-1', { userId: 'user-1', prismaClient: prisma });

    expect(result.finalBalance).toBe(6);
    expect(result.entryCount).toBe(2);
    expect(result.trail[0]).toMatchObject({
      entryId: 'entry-1',
      runningBalance: 10,
      explanation: 'Credited 10 — "Deposit" — balance became 10'
    });
    expect(result.trail[1]).toMatchObject({
      entryId: 'entry-2',
      runningBalance: 6,
      explanation: 'Debited 4 — "Withdrawal" — balance became 6'
    });
  });
});
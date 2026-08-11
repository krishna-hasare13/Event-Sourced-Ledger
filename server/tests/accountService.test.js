const { getBalance } = require('../services/accountService');

function createPrismaClient() {
  const state = {
    account: { id: 'acc-1', ownerId: 'user-1', type: 'asset' },
    entries: [
      { amount: 10.5, createdAt: new Date('2026-07-29T00:00:00.000Z') },
      { amount: -2.25, createdAt: new Date('2026-07-30T00:00:00.000Z') }
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
      aggregate: jest.fn(async ({ where }) => {
        const total = state.entries
          .filter(entry => entry.createdAt <= (where.createdAt?.lte || new Date('9999-12-31T23:59:59.999Z')))
          .reduce((sum, entry) => sum + entry.amount, 0);
        return { _sum: { amount: total } };
      })
    }
  };
}

describe('account service', () => {
  test('getBalance returns the current balance', async () => {
    const prisma = createPrismaClient();
    await expect(getBalance('acc-1', null, { userId: 'user-1', prismaClient: prisma })).resolves.toBe(8.25);
  });

  test('getBalance respects asOf filters', async () => {
    const prisma = createPrismaClient();
    await expect(getBalance('acc-1', '2026-07-29T12:00:00.000Z', { userId: 'user-1', prismaClient: prisma })).resolves.toBe(10.5);
  });
});
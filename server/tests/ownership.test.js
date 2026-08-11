const { createTransaction } = require('../services/transactionService');

function createClient() {
  const state = {
    accounts: new Map([
      ['owned', { id: 'owned', type: 'asset', ownerId: 'user-a' }],
      ['foreign', { id: 'foreign', type: 'equity', ownerId: 'user-b' }]
    ]),
    entries: [],
    transactions: new Map(),
    idempotencyKeys: new Map(),
    nextTransactionNumber: 1,
    nextEntryNumber: 1
  };

  const tx = {
    $queryRawUnsafe: jest.fn(async () => undefined),
    account: {
      findMany: jest.fn(async ({ where }) => {
        const items = [...state.accounts.values()].filter(account => {
          if (where?.ownerId && account.ownerId !== where.ownerId) return false;
          if (where?.id?.in && !where.id.in.includes(account.id)) return false;
          return true;
        });
        return items;
      }),
      findFirst: jest.fn(async ({ where }) => {
        const account = state.accounts.get(where.id) || null;
        if (!account) return null;
        if (where.ownerId && account.ownerId !== where.ownerId) return null;
        return account;
      })
    },
    entry: {
      aggregate: jest.fn(async () => ({ _sum: { amount: 0 } })),
      create: jest.fn(async ({ data }) => {
        const entry = { id: `entry_${state.nextEntryNumber++}`, ...data };
        state.entries.push(entry);
        return entry;
      })
    },
    transaction: {
      create: jest.fn(async ({ data }) => {
        const transaction = { id: `tx_${state.nextTransactionNumber++}`, description: data.description, createdAt: new Date() };
        state.transactions.set(transaction.id, transaction);
        return transaction;
      }),
      findUnique: jest.fn(async ({ where }) => state.transactions.get(where.id) || null)
    },
    idempotencyKey: {
      findFirst: jest.fn(async () => null),
      findUnique: jest.fn(async () => null),
      deleteMany: jest.fn(async () => ({ count: 0 })),
      create: jest.fn(async () => ({ key: 'k', fingerprint: 'f', resultId: 'tx_1' }))
    }
  };

  return {
    $transaction: jest.fn(async (callback) => callback(tx)),
    account: tx.account,
    entry: tx.entry,
    transaction: tx.transaction,
    idempotencyKey: tx.idempotencyKey
  };
}

describe('transaction ownership', () => {
  test('user A cannot transact against user B account', async () => {
    const prisma = createClient();

    await expect(
      createTransaction(
        { description: 'x', entries: [{ accountId: 'owned', amount: 10 }, { accountId: 'foreign', amount: -10 }] },
        { userId: 'user-a', prismaClient: prisma }
      )
    ).rejects.toThrow(/account not found/i);
  });
});
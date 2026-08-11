const { createTransaction } = require('../services/transactionService');

function createFakePrismaClient(sharedState) {
  const state = sharedState || {
    accounts: new Map([
      ['a1', { id: 'a1', type: 'asset', ownerId: 'user-a' }],
      ['a2', { id: 'a2', type: 'equity', ownerId: 'user-a' }]
    ]),
    transactions: new Map(),
    entries: [],
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
      findMany: jest.fn(async ({ where }) => {
        const items = [...state.accounts.values()].filter(account => {
          if (where?.ownerId && account.ownerId !== where.ownerId) return false;
          if (where?.id?.in && !where.id.in.includes(account.id)) return false;
          return true;
        });
        return items;
      }),
      findUnique: jest.fn(async ({ where }) => state.accounts.get(where.id) || null),
      findFirst: jest.fn(async ({ where }) => {
        const account = state.accounts.get(where.id) || null;
        if (!account) return null;
        if (where.ownerId && account.ownerId !== where.ownerId) return null;
        return account;
      })
    },
    entry: {
      aggregate: jest.fn(async ({ where }) => {
        const sum = state.entries
          .filter(entry => entry.accountId === where.accountId)
          .reduce((total, entry) => total + Number(entry.amount), 0);
        return { _sum: { amount: sum } };
      }),
      create: jest.fn(async ({ data }) => {
        const entry = { id: `entry_${state.nextEntryNumber++}`, ...data };
        state.entries.push(entry);
        return entry;
      })
    },
    transaction: {
      create: jest.fn(async ({ data }) => {
        const transaction = {
          id: `tx_${state.nextTransactionNumber++}`,
          description: data.description,
          createdAt: new Date()
        };
        state.transactions.set(transaction.id, transaction);
        return transaction;
      }),
      findUnique: jest.fn(async ({ where }) => state.transactions.get(where.id) || null)
    },
    idempotencyKey: {
      findUnique: jest.fn(async ({ where }) => state.idempotencyKeys.get(where.key) || null),
      findFirst: jest.fn(async ({ where }) => {
        const existing = state.idempotencyKeys.get(where.key);
        if (!existing) return null;
        if (where.createdAt?.gte && existing.createdAt < where.createdAt.gte) return null;
        return existing;
      }),
      deleteMany: jest.fn(async ({ where }) => {
        const cutoff = where?.createdAt?.lt;
        if (!cutoff) return { count: 0 };
        let deleted = 0;
        for (const [key, value] of [...state.idempotencyKeys.entries()]) {
          if (value.createdAt < cutoff) {
            state.idempotencyKeys.delete(key);
            deleted += 1;
          }
        }
        return { count: deleted };
      }),
      create: jest.fn(async ({ data }) => {
        if (state.idempotencyKeys.has(data.key)) {
          const error = new Error('Unique constraint failed on the fields: (`key`)');
          error.code = 'P2002';
          throw error;
        }
        const row = { ...data, createdAt: new Date() };
        state.idempotencyKeys.set(data.key, row);
        return row;
      })
    }
  };

  return {
    __state: state,
    $transaction: jest.fn(async (callback) => callback(tx)),
    account: tx.account,
    entry: tx.entry,
    transaction: tx.transaction,
    idempotencyKey: tx.idempotencyKey
  };
}

describe('transaction service', () => {
  test('same key and same payload returns the same result', async () => {
    const prisma = createFakePrismaClient();
    const payload = { description: 'x', entries: [{ accountId: 'a1', amount: 10 }, { accountId: 'a2', amount: -10 }] };

    const first = await createTransaction(payload, { idempotencyKey: 'key-1', userId: 'user-a', prismaClient: prisma });
    const second = await createTransaction(payload, { idempotencyKey: 'key-1', userId: 'user-a', prismaClient: prisma });

    expect(second).toEqual(first);
    expect(prisma.idempotencyKey.create).toHaveBeenCalledTimes(1);
  });

  test('same key and different payload is rejected', async () => {
    const prisma = createFakePrismaClient();
    await createTransaction({ description: 'x', entries: [{ accountId: 'a1', amount: 10 }, { accountId: 'a2', amount: -10 }] }, { idempotencyKey: 'key-1', userId: 'user-a', prismaClient: prisma });

    await expect(
      createTransaction({ description: 'x', entries: [{ accountId: 'a1', amount: 20 }, { accountId: 'a2', amount: -20 }] }, { idempotencyKey: 'key-1', userId: 'user-a', prismaClient: prisma })
    ).rejects.toThrow(/different payload/i);
  });

  test('missing idempotency key proceeds normally', async () => {
    const prisma = createFakePrismaClient();
    const transaction = await createTransaction({ description: 'x', entries: [{ accountId: 'a1', amount: 10 }, { accountId: 'a2', amount: -10 }] }, { userId: 'user-a', prismaClient: prisma });

    expect(transaction).toMatchObject({ id: 'tx_1', description: 'x' });
    expect(prisma.idempotencyKey.create).not.toHaveBeenCalled();
  });

  test('idempotency key survives a fresh client instance', async () => {
    const firstClient = createFakePrismaClient();
    const payload = { description: 'x', entries: [{ accountId: 'a1', amount: 10 }, { accountId: 'a2', amount: -10 }] };

    const first = await createTransaction(payload, { idempotencyKey: 'key-1', userId: 'user-a', prismaClient: firstClient });
    const secondClient = createFakePrismaClient(firstClient.__state);
    const second = await createTransaction(payload, { idempotencyKey: 'key-1', userId: 'user-a', prismaClient: secondClient });

    expect(second).toEqual(first);
    expect(secondClient.idempotencyKey.findFirst).toHaveBeenCalled();
  });
});

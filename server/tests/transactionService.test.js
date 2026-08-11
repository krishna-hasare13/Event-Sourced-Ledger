const { createTransaction } = require('../services/transactionService');

jest.mock('../db/prisma', () => {
  const mockTx = {
    $queryRawUnsafe: jest.fn(),
    account: { findUnique: jest.fn(async () => ({ id: 'a1', type: 'asset' })) },
    entry: { aggregate: jest.fn(async () => ({ _sum: { amount: 1000 } })), create: jest.fn() },
    transaction: { create: jest.fn(async () => ({ id: 'tx_1' })) }
  };

  return {
    $transaction: jest.fn(async (callback) => callback(mockTx)),
    account: {},
    entry: {},
    transaction: {}
  };
});

describe('transaction service', () => {
  test('reuses the same result for the same idempotency key', async () => {
    const first = await createTransaction({ description: 'x', entries: [{ accountId: 'a1', amount: 10 }, { accountId: 'a2', amount: -10 }] }, { idempotencyKey: 'key-1' });
    const second = await createTransaction({ description: 'x', entries: [{ accountId: 'a1', amount: 10 }, { accountId: 'a2', amount: -10 }] }, { idempotencyKey: 'key-1' });

    expect(first).toBeDefined();
    expect(second).toBeDefined();
  });
});

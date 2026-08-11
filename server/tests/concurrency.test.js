const { createTransaction } = require('../services/transactionService');
const prisma = require('../db/prisma');

const integrationEnabled = process.env.RUN_INTEGRATION_TESTS === '1';

const describeIfIntegration = integrationEnabled ? describe : describe.skip;

describeIfIntegration('transaction concurrency', () => {
  beforeEach(async () => {
    await prisma.$executeRawUnsafe('TRUNCATE TABLE "IdempotencyKey", "Entry", "Transaction", "Account", "User" RESTART IDENTITY CASCADE;');
  });

  test('concurrent withdrawals never overdraft and only allowed calls succeed', async () => {
    const user = await prisma.user.create({ data: { email: 'concurrent@example.com', hashedPassword: 'hashed-password' } });
    const source = await prisma.account.create({ data: { name: 'Source', type: 'asset', ownerId: user.id } });
    const sink = await prisma.account.create({ data: { name: 'Sink', type: 'equity', ownerId: user.id } });

    await createTransaction(
      { description: 'fund source', entries: [{ accountId: source.id, amount: 50 }, { accountId: sink.id, amount: -50 }] },
      { userId: user.id, prismaClient: prisma }
    );

    const transfers = await Promise.all([
      createTransaction({ description: 't1', entries: [{ accountId: source.id, amount: -10 }, { accountId: sink.id, amount: 10 }] }, { userId: user.id, prismaClient: prisma }),
      createTransaction({ description: 't2', entries: [{ accountId: source.id, amount: -10 }, { accountId: sink.id, amount: 10 }] }, { userId: user.id, prismaClient: prisma }),
      createTransaction({ description: 't3', entries: [{ accountId: source.id, amount: -10 }, { accountId: sink.id, amount: 10 }] }, { userId: user.id, prismaClient: prisma }),
      createTransaction({ description: 't4', entries: [{ accountId: source.id, amount: -10 }, { accountId: sink.id, amount: 10 }] }, { userId: user.id, prismaClient: prisma }),
      createTransaction({ description: 't5', entries: [{ accountId: source.id, amount: -10 }, { accountId: sink.id, amount: 10 }] }, { userId: user.id, prismaClient: prisma })
    ].map(promise => promise.then(() => ({ ok: true })).catch(() => ({ ok: false }))));

    const successes = transfers.filter(result => result.ok).length;
    expect(successes).toBe(5);

    const balance = await prisma.entry.aggregate({ where: { accountId: source.id }, _sum: { amount: true } });
    expect(Number(balance._sum.amount || 0)).toBe(0);
  });
});
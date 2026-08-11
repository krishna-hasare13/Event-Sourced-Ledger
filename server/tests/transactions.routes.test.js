const request = require('supertest');
const app = require('../index');

const integrationEnabled = process.env.RUN_INTEGRATION_TESTS === '1';

const describeIfIntegration = integrationEnabled ? describe : describe.skip;

describeIfIntegration('transactions routes', () => {
  test('supports idempotent transfers for the authenticated user', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send({ email: 'trader@example.com', password: 'password123' });

    const token = response.body.token;

    const asset = await request(app)
      .post('/api/accounts')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Asset', type: 'asset' });

    const equity = await request(app)
      .post('/api/accounts')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Equity', type: 'equity' });

    const first = await request(app)
      .post('/api/transactions')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', 'route-key-1')
      .send({
        description: 'seed transfer',
        entries: [
          { accountId: asset.body.id, amount: 25 },
          { accountId: equity.body.id, amount: -25 }
        ]
      });

    expect(first.status).toBe(201);

    const second = await request(app)
      .post('/api/transactions')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', 'route-key-1')
      .send({
        description: 'seed transfer',
        entries: [
          { accountId: asset.body.id, amount: 25 },
          { accountId: equity.body.id, amount: -25 }
        ]
      });

    expect(second.status).toBe(201);
    expect(second.body.id).toBe(first.body.id);
  });
});
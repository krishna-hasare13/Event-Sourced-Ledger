const request = require('supertest');
const app = require('../index');

const integrationEnabled = process.env.RUN_INTEGRATION_TESTS === '1';

const describeIfIntegration = integrationEnabled ? describe : describe.skip;

describeIfIntegration('accounts routes', () => {
  test('scopes accounts to the authenticated user and hides foreign accounts', async () => {
    const alice = await request(app)
      .post('/api/auth/register')
      .send({ email: 'alice@example.com', password: 'password123' });

    const bob = await request(app)
      .post('/api/auth/register')
      .send({ email: 'bob@example.com', password: 'password123' });

    const aliceToken = alice.body.token;
    const bobToken = bob.body.token;

    const aliceAccount = await request(app)
      .post('/api/accounts')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ name: 'Alice Checking', type: 'asset' });

    const bobAccount = await request(app)
      .post('/api/accounts')
      .set('Authorization', `Bearer ${bobToken}`)
      .send({ name: 'Bob Savings', type: 'asset' });

    const listResponse = await request(app)
      .get('/api/accounts')
      .set('Authorization', `Bearer ${aliceToken}`);

    expect(listResponse.status).toBe(200);
    expect(listResponse.body.items).toHaveLength(1);
    expect(listResponse.body.items[0].id).toBe(aliceAccount.body.id);

    const foreignResponse = await request(app)
      .get(`/api/accounts/${bobAccount.body.id}`)
      .set('Authorization', `Bearer ${aliceToken}`);

    expect(foreignResponse.status).toBe(404);
    expect(foreignResponse.body.error).toMatch(/not found/i);
  });
});
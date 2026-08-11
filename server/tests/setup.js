const path = require('path');
const { execSync } = require('child_process');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const integrationEnabled = process.env.RUN_INTEGRATION_TESTS === '1';

if (integrationEnabled) {
  const testDatabaseUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
  if (!testDatabaseUrl) {
    throw new Error('RUN_INTEGRATION_TESTS=1 requires TEST_DATABASE_URL or DATABASE_URL');
  }

  process.env.DATABASE_URL = testDatabaseUrl;

  execSync('npx prisma migrate deploy', {
    cwd: path.resolve(__dirname, '..'),
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: testDatabaseUrl }
  });

  const prisma = require('../db/prisma');

  async function truncateTables() {
    await prisma.$executeRawUnsafe('TRUNCATE TABLE "IdempotencyKey", "Entry", "Transaction", "Account", "User" RESTART IDENTITY CASCADE;');
  }

  beforeAll(async () => {
    await truncateTables();
  });

  beforeEach(async () => {
    await truncateTables();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });
}
const BASE = 'http://localhost:4000/api';

async function createAccount(name, type) {
  const res = await fetch(`${BASE}/accounts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, type })
  });
  return res.json();
}

async function createTransaction(description, entries) {
  const res = await fetch(`${BASE}/transactions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ description, entries })
  });
  return { status: res.status, body: await res.json() };
}

async function getBalance(accountId) {
  const res = await fetch(`${BASE}/accounts/${accountId}/balance`);
  const data = await res.json();
  return Number(data.balance);
}

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    process.exitCode = 1;
  } else {
    console.log(`✅ PASS: ${message}`);
  }
}

async function transfer(fromId, toId, amount) {
  return createTransaction('Concurrent transfer', [
    { accountId: fromId, amount: -amount },
    { accountId: toId, amount }
  ]);
}

async function main() {
  console.log('--- Setting up fresh accounts ---');
  const external = await createAccount(`External-${Date.now()}`, 'equity');
  const alice = await createAccount(`Alice-${Date.now()}`, 'asset');
  const bob = await createAccount(`Bob-${Date.now()}`, 'asset');

  // Fund Alice with exactly 50
  await createTransaction('Fund Alice', [
    { accountId: alice.id, amount: 50 },
    { accountId: external.id, amount: -50 }
  ]);

  const startBalance = await getBalance(alice.id);
  assert(startBalance === 50, `Alice should start with 50, got ${startBalance}`);

  console.log('--- Test 1: Fire 5 concurrent transfers of 10 each (exactly enough funds) ---');
  const results1 = await Promise.all([
    transfer(alice.id, bob.id, 10),
    transfer(alice.id, bob.id, 10),
    transfer(alice.id, bob.id, 10),
    transfer(alice.id, bob.id, 10),
    transfer(alice.id, bob.id, 10),
  ]);
  const succeeded1 = results1.filter(r => r.status === 201).length;
  assert(succeeded1 === 5, `All 5 transfers should succeed (exact funds), got ${succeeded1}`);

  const aliceAfter1 = await getBalance(alice.id);
  const bobAfter1 = await getBalance(bob.id);
  assert(aliceAfter1 === 0, `Alice should be 0 after exact draw-down, got ${aliceAfter1}`);
  assert(bobAfter1 === 50, `Bob should have 50, got ${bobAfter1}`);

  console.log('--- Test 2: Fire 5 concurrent transfers of 10 each with ZERO funds (all should fail) ---');
  const results2 = await Promise.all([
    transfer(alice.id, bob.id, 10),
    transfer(alice.id, bob.id, 10),
    transfer(alice.id, bob.id, 10),
    transfer(alice.id, bob.id, 10),
    transfer(alice.id, bob.id, 10),
  ]);
  const succeeded2 = results2.filter(r => r.status === 201).length;
  assert(succeeded2 === 0, `No transfers should succeed with 0 balance, got ${succeeded2} succeeded`);

  const aliceAfter2 = await getBalance(alice.id);
  const bobAfter2 = await getBalance(bob.id);
  assert(aliceAfter2 === 0, `Alice should still be 0, got ${aliceAfter2}`);
  assert(bobAfter2 === 50, `Bob should still be 50 (no corruption), got ${bobAfter2}`);

  console.log('--- Test 3: Refund Alice with 25, fire 5 concurrent transfers of 10 (partial success expected) ---');
  await createTransaction('Refund Alice', [
    { accountId: alice.id, amount: 25 },
    { accountId: external.id, amount: -25 }
  ]);

  const results3 = await Promise.all([
    transfer(alice.id, bob.id, 10),
    transfer(alice.id, bob.id, 10),
    transfer(alice.id, bob.id, 10),
    transfer(alice.id, bob.id, 10),
    transfer(alice.id, bob.id, 10),
  ]);
  const succeeded3 = results3.filter(r => r.status === 201).length;
  assert(succeeded3 === 2, `Exactly 2 of 5 transfers should succeed (25/10=2 with remainder), got ${succeeded3}`);

  const aliceAfter3 = await getBalance(alice.id);
  assert(aliceAfter3 === 5, `Alice should have 5 left (25 - 20), got ${aliceAfter3}`);
  assert(aliceAfter3 >= 0, `Alice balance must never go negative — CRITICAL invariant`);

  console.log('\nDone.');
}

main().catch(err => {
  console.error('Test script crashed:', err);
  process.exitCode = 1;
});
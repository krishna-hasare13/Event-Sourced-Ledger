# Ledger — Double-Entry Accounting Backend

A backend-focused project built to demonstrate production-grade backend engineering: transactional integrity, concurrency safety, and idempotent APIs — not just CRUD.

Full-stack (Express + PostgreSQL/Prisma + React), but the point of this project is the **backend correctness guarantees**, detailed below.

---

## Why this project exists

Most portfolio CRUD apps don't touch the problems that actually break financial/transactional systems in production: race conditions on concurrent writes, partial failures, retried requests, and floating-point money bugs. This project is a small, focused system built specifically to get those right.

---

## Core guarantees

**1. Double-entry integrity**
Every transaction is a set of ≥2 entries whose amounts sum to exactly zero, enforced in `ledgerValidation.js`. No transaction can be persisted unless it balances — money can't be created or destroyed by the system.

**2. No floating-point drift**
Amounts are converted to integer cents before any arithmetic (`amountToCents` / `centsToAmount`) and only converted back to decimal for storage/display. Avoids the classic `0.1 + 0.2 !== 0.3` class of bugs in financial calculations.

**3. Concurrency-safe transfers**
Transfers between accounts run inside a single DB transaction that:
- Locks all involved account rows with `SELECT ... FOR UPDATE`
- Locks rows in a **consistent sorted order** across concurrent requests, specifically to prevent deadlocks when two transactions touch the same accounts in opposite order
- Re-checks account balances *after* acquiring locks, so overdraft checks can't race

Verified with a concurrent-load test (`testTransactions.js`) that fires simultaneous transfers against shared accounts and asserts the exact number that should succeed given the available balance — confirming no double-spend and no lost updates under contention.

**4. Overdraft protection**
Asset accounts cannot go negative. Enforced at the database-transaction level, not just in application logic, so it holds even under concurrent requests.

**5. Idempotent writes**
POST `/transactions` accepts an `Idempotency-Key` header. Retried requests with the same key return the original result instead of creating a duplicate transaction; the same key reused with a *different* payload is rejected. This protects against duplicate transactions from client retries or network failures.

**6. Auditability**
Every account exposes a full audit trail (`/accounts/:id/audit`) that replays its entries in order and reconstructs a running balance with a human-readable explanation per entry — so every balance is fully traceable back to the transactions that produced it.

---

## Architecture

```
client/          React (Vite) UI — accounts table, transfer form, audit trail view
server/
  routes/        Thin HTTP layer (accounts, transactions)
  services/      Business logic: validation, transaction orchestration, balances, audit
  db/            Prisma client (Postgres)
  prisma/        Schema + migrations
```

**Data model:** `Account` → `Entry` ← `Transaction`. Balances are never stored directly — they're always derived by summing entries, so the ledger is the single source of truth and balances can be recomputed as-of any point in time (`GET /accounts/:id/balance?asOf=...`).

---

## API

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/accounts` | Create an account (`name`, `type`: asset\|liability\|equity\|credit) |
| `GET` | `/api/accounts` | List all accounts |
| `GET` | `/api/accounts/:id` | Get a single account |
| `GET` | `/api/accounts/:id/balance?asOf=` | Get current or historical balance |
| `GET` | `/api/accounts/:id/audit` | Full audit trail with running balance |
| `POST` | `/api/transactions` | Create a transaction (entries must sum to zero). Supports `Idempotency-Key` header |

---

## Running locally

```bash
# Server
cd server
npm install
# set DATABASE_URL in a .env file (PostgreSQL connection string)
npx prisma migrate deploy
npm start        # or: node index.js

# Client
cd client
npm install
npm run dev
```

Run backend tests:
```bash
cd server
npx jest
```

Run the concurrency stress test (server must be running against a real DB):
```bash
node server/testTransactions.js
```

---

## Known limitations / honest trade-offs

- **Idempotency keys are stored in-memory** (`Map`), so they don't survive a server restart and won't work across multiple server instances. In a real deployment this would move to Redis or a DB table with a TTL — noted here deliberately rather than hidden.
- **No authentication/authorization** — any client can act on any account. Out of scope for this project's focus (transactional correctness), but would be required before this touches real money.
- **Not literal event sourcing** — despite the project name, this is an append-only ledger with balances derived by aggregation, not a system that rebuilds state by replaying a stored event log through handlers. The append-only + derived-state pattern is what actually matters for correctness here; the name is aspirational and worth revisiting.

---

## What this project is meant to demonstrate

Given a fixed system that touches money, the ability to reason about: what actually needs a transaction and a lock, how to keep concurrent writers from corrupting shared state, how to make writes safe to retry, and how to keep every number traceable back to its source. That's the backend skill this repo is built to show — not the amount of code, but whether the guarantees actually hold under contention.
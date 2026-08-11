# Ledger - Double-Entry Backend Systems Project

A backend-focused ledger project built to demonstrate correctness under concurrency: transactional integrity, ownership-scoped authorization, idempotent writes, and traceable audit history.

Stack:
- Server: Express + Prisma + PostgreSQL
- Client: React + Vite

## Core guarantees

1. Double-entry integrity
- Every transaction must contain at least two entries.
- Entries must include both positive and negative amounts.
- Entries must sum to zero exactly.

2. No floating-point drift
- Monetary arithmetic uses integer cents before persistence.

3. Concurrency-safe transfer path
- Transfer writes run inside a single database transaction.
- Account rows are locked with `SELECT ... FOR UPDATE` in sorted account-id order to avoid deadlocks.
- Overdraft checks are performed after locks are acquired.

4. Persistent idempotency keys
- `POST /api/transactions` accepts `Idempotency-Key`.
- Keys are stored in PostgreSQL (`IdempotencyKey` table), not in process memory.
- Same key + same payload returns the original transaction.
- Same key + different payload is rejected.
- Keys are retained for 24 hours and cleaned up opportunistically on idempotent transaction attempts.

5. Authentication and ownership
- JWT auth via `POST /api/auth/register` and `POST /api/auth/login`.
- Accounts are owned by users (`Account.ownerId`).
- `/api/accounts` and `/api/transactions` require a bearer token.
- Account reads and audit endpoints are ownership-scoped.
- Requests for non-owned accounts return 404.

6. Observability and request tracing
- Structured JSON logging through `pino`.
- Request-id middleware attaches `X-Request-Id`.
- Error responses include `requestId`.
- Transaction attempts log request id, user id, account ids, idempotency key, outcome, and duration.

7. API guardrails
- Route-layer validation uses `zod`.
- Cursor pagination is enabled for:
  - `GET /api/accounts`
  - `GET /api/accounts/:id/audit`
- Rate limiting is applied to `/api/auth/*` and `/api/transactions`.
- OpenAPI document is served at `GET /api/docs`.

## API overview

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/accounts`
- `GET /api/accounts?cursor=&limit=`
- `GET /api/accounts/:id`
- `GET /api/accounts/:id/balance?asOf=`
- `GET /api/accounts/:id/audit?cursor=&limit=`
- `POST /api/transactions` (supports `Idempotency-Key`)

## Running locally (Docker-first)

### Recommended path: Docker Compose

From the repository root:

```bash
docker compose up --build
```

This starts:
- PostgreSQL on port `5432`
- Server on port `4000`

Then run the client separately:

```bash
cd client
npm install
npm run dev
```

Create `client/.env` from `client/.env.example` if needed.

### Manual path (without Docker)

1. Start PostgreSQL manually.
2. Configure environment files.

Server:

```bash
cd server
cp .env.example .env
npm install
npx prisma generate
npx prisma migrate deploy
npm start
```

Client:

```bash
cd client
cp .env.example .env
npm install
npm run dev
```

## Environment variables

Server (`server/.env.example`):
- `DATABASE_URL`
- `JWT_SECRET`
- `PORT`
- `LOG_LEVEL`
- `TEST_DATABASE_URL` (optional, for integration tests)

Client (`client/.env.example`):
- `VITE_API_URL`

## Testing

Server unit/default suite:

```bash
cd server
npm test
```

Integration tests are present for accounts and transactions routes, plus a concurrency test, and are gated behind:

- `RUN_INTEGRATION_TESTS=1`
- a reachable Postgres test database (`TEST_DATABASE_URL` or `DATABASE_URL`)

Client checks:

```bash
cd client
npm run lint
npm run build
```

## CI

GitHub Actions workflow: `.github/workflows/ci.yml`

On push and pull request:
- Server: `npm ci`, `npm test`
- Client: `npm ci`, `npm run lint`, `npm run build`

## Troubleshooting

- `docker compose up` fails with `Bind for 0.0.0.0:5432 failed: port is already allocated`:
  - Another local PostgreSQL service or container is already using port `5432`.
  - Stop the existing process/container, or run tests against the existing local Postgres instance.
  - Example local container check: `docker ps`.

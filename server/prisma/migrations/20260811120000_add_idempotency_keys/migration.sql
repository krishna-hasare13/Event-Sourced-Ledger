-- Idempotency keys are retained for 24 hours in application code and cleaned up opportunistically.
CREATE TABLE "IdempotencyKey" (
    "key" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "resultId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IdempotencyKey_pkey" PRIMARY KEY ("key")
);

CREATE INDEX "IdempotencyKey_createdAt_idx" ON "IdempotencyKey"("createdAt");
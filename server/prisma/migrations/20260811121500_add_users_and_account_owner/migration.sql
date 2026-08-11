-- Users authenticate with email/password and own accounts through ownerId.
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "hashedPassword" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

ALTER TABLE "Account" ADD COLUMN "ownerId" TEXT;
CREATE INDEX "Account_ownerId_createdAt_idx" ON "Account"("ownerId", "createdAt");

ALTER TABLE "Account"
ADD CONSTRAINT "Account_ownerId_fkey"
FOREIGN KEY ("ownerId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
-- Location monthly fee (backfill from legacy client fee)
ALTER TABLE "Store" ADD COLUMN "monthlyFee" REAL NOT NULL DEFAULT 20;

UPDATE "Store"
SET "monthlyFee" = COALESCE(
  (
    SELECT "monthlyFeePerStore"
    FROM "Client"
    WHERE "Client"."id" = "Store"."clientId"
  ),
  20
);

-- Business → business referral (FK enforced by Prisma)
ALTER TABLE "Client" ADD COLUMN "referredByClientId" TEXT;

CREATE INDEX "Client_referredByClientId_idx" ON "Client"("referredByClientId");

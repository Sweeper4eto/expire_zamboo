-- AlterTable
ALTER TABLE "Client" ADD COLUMN "paymentsRequiredSince" DATETIME;

-- Existing clients already on payments: start billing from this month (one-month grace).
UPDATE "Client"
SET "paymentsRequiredSince" = datetime('now', 'start of month')
WHERE "paymentsRequired" = 1;

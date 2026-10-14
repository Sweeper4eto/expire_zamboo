-- Link Minimart locator pins to expire365 client accounts (SQLite-safe; FK enforced by Prisma)
ALTER TABLE "MinimartLocatorStore" ADD COLUMN "clientId" TEXT;

CREATE INDEX "MinimartLocatorStore_clientId_idx" ON "MinimartLocatorStore"("clientId");

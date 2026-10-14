-- AlterTable
ALTER TABLE "InventoryEntry" ADD COLUMN "priceReducedByUserId" TEXT;

-- CreateIndex
CREATE INDEX "InventoryEntry_priceReducedByUserId_idx" ON "InventoryEntry"("priceReducedByUserId");

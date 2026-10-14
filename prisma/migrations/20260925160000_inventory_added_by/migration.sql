-- AlterTable
ALTER TABLE "InventoryEntry" ADD COLUMN "addedByUserId" TEXT;

-- CreateIndex
CREATE INDEX "InventoryEntry_addedByUserId_idx" ON "InventoryEntry"("addedByUserId");

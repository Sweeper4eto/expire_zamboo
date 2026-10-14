-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_BuyListEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "storeId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "barcode" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "enteredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "removedAt" DATETIME,
    CONSTRAINT "BuyListEntry_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BuyListEntry_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_BuyListEntry" ("barcode", "enteredAt", "id", "productId", "quantity", "removedAt", "storeId") SELECT "barcode", "enteredAt", "id", "productId", "quantity", "removedAt", "storeId" FROM "BuyListEntry";
DROP TABLE "BuyListEntry";
ALTER TABLE "new_BuyListEntry" RENAME TO "BuyListEntry";
CREATE INDEX "BuyListEntry_storeId_removedAt_idx" ON "BuyListEntry"("storeId", "removedAt");
CREATE TABLE "new_InventoryEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "storeId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "barcode" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "expiryDate" DATETIME NOT NULL,
    "enteredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "removedAt" DATETIME,
    "priceReducedAt" DATETIME,
    "deletedAt" DATETIME,
    CONSTRAINT "InventoryEntry_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "InventoryEntry_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_InventoryEntry" ("barcode", "deletedAt", "enteredAt", "expiryDate", "id", "priceReducedAt", "productId", "quantity", "removedAt", "storeId") SELECT "barcode", "deletedAt", "enteredAt", "expiryDate", "id", "priceReducedAt", "productId", "quantity", "removedAt", "storeId" FROM "InventoryEntry";
DROP TABLE "InventoryEntry";
ALTER TABLE "new_InventoryEntry" RENAME TO "InventoryEntry";
CREATE INDEX "InventoryEntry_storeId_expiryDate_idx" ON "InventoryEntry"("storeId", "expiryDate");
CREATE INDEX "InventoryEntry_storeId_removedAt_deletedAt_idx" ON "InventoryEntry"("storeId", "removedAt", "deletedAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

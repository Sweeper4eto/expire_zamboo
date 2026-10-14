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
    CONSTRAINT "BuyListEntry_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
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
    "articul" TEXT,
    "imagePath" TEXT,
    "quantity" INTEGER NOT NULL,
    "expiryDate" DATETIME NOT NULL,
    "enteredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "removedAt" DATETIME,
    "priceReducedAt" DATETIME,
    "deletedAt" DATETIME,
    CONSTRAINT "InventoryEntry_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "InventoryEntry_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_InventoryEntry" ("articul", "barcode", "deletedAt", "enteredAt", "expiryDate", "id", "imagePath", "priceReducedAt", "productId", "quantity", "removedAt", "storeId") SELECT "articul", "barcode", "deletedAt", "enteredAt", "expiryDate", "id", "imagePath", "priceReducedAt", "productId", "quantity", "removedAt", "storeId" FROM "InventoryEntry";
DROP TABLE "InventoryEntry";
ALTER TABLE "new_InventoryEntry" RENAME TO "InventoryEntry";
CREATE INDEX "InventoryEntry_storeId_expiryDate_idx" ON "InventoryEntry"("storeId", "expiryDate");
CREATE INDEX "InventoryEntry_storeId_removedAt_deletedAt_idx" ON "InventoryEntry"("storeId", "removedAt", "deletedAt");
CREATE TABLE "new_PushNotificationLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "sentAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PushNotificationLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_PushNotificationLog" ("id", "kind", "sentAt", "userId") SELECT "id", "kind", "sentAt", "userId" FROM "PushNotificationLog";
DROP TABLE "PushNotificationLog";
ALTER TABLE "new_PushNotificationLog" RENAME TO "PushNotificationLog";
CREATE INDEX "PushNotificationLog_userId_kind_sentAt_idx" ON "PushNotificationLog"("userId", "kind", "sentAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "Product_name_idx" ON "Product"("name");

-- CreateIndex
CREATE INDEX "Store_clientId_idx" ON "Store"("clientId");

-- CreateIndex
CREATE INDEX "User_clientId_idx" ON "User"("clientId");

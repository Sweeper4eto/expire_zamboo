-- CreateTable
CREATE TABLE "ZambooItem" (
    "gId" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "altName" TEXT NOT NULL DEFAULT '',
    "nameNormalized" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "barcode" TEXT,
    "uomName" TEXT,
    "categoryName" TEXT,
    "typeName" TEXT,
    "itemType" INTEGER NOT NULL DEFAULT 1,
    "basePrice" REAL NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "syncedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "ZambooItem_code_key" ON "ZambooItem"("code");

-- CreateIndex
CREATE INDEX "ZambooItem_nameNormalized_idx" ON "ZambooItem"("nameNormalized");

-- CreateIndex
CREATE INDEX "ZambooItem_barcode_idx" ON "ZambooItem"("barcode");

-- CreateIndex
CREATE INDEX "ZambooItem_active_idx" ON "ZambooItem"("active");

-- CreateTable
CREATE TABLE "ZambooSyncState" (
    "id" INTEGER NOT NULL PRIMARY KEY,
    "lastSyncAt" DATETIME,
    "itemCount" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "updatedAt" DATETIME NOT NULL
);

INSERT INTO "ZambooSyncState" ("id", "itemCount", "updatedAt")
VALUES (1, 0, CURRENT_TIMESTAMP);

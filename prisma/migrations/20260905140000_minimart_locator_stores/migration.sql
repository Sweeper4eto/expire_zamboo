-- CreateTable
CREATE TABLE "MinimartLocatorStore" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "externalId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "street" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "postalCode" TEXT,
    "country" TEXT,
    "lat" REAL NOT NULL,
    "lng" REAL NOT NULL,
    "phone" TEXT,
    "website" TEXT,
    "openHoursJson" TEXT,
    "slug" TEXT,
    "marked" BOOLEAN NOT NULL DEFAULT false,
    "comment" TEXT NOT NULL DEFAULT '',
    "syncedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "MinimartLocatorStore_externalId_key" ON "MinimartLocatorStore"("externalId");

-- CreateIndex
CREATE INDEX "MinimartLocatorStore_city_idx" ON "MinimartLocatorStore"("city");

-- CreateIndex
CREATE INDEX "MinimartLocatorStore_marked_idx" ON "MinimartLocatorStore"("marked");

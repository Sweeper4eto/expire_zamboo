-- Replace boolean "marked" with CRM status for map pin colors.
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_MinimartLocatorStore" (
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
    "status" TEXT NOT NULL DEFAULT 'NOT_VISITED',
    "comment" TEXT NOT NULL DEFAULT '',
    "syncedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_MinimartLocatorStore" (
    "id", "externalId", "title", "street", "city", "postalCode", "country",
    "lat", "lng", "phone", "website", "openHoursJson", "slug",
    "status", "comment", "syncedAt", "createdAt", "updatedAt"
)
SELECT
    "id", "externalId", "title", "street", "city", "postalCode", "country",
    "lat", "lng", "phone", "website", "openHoursJson", "slug",
    CASE WHEN "marked" = 1 THEN 'ACCEPTED' ELSE 'NOT_VISITED' END,
    "comment", "syncedAt", "createdAt", "updatedAt"
FROM "MinimartLocatorStore";
DROP TABLE "MinimartLocatorStore";
ALTER TABLE "new_MinimartLocatorStore" RENAME TO "MinimartLocatorStore";
CREATE UNIQUE INDEX "MinimartLocatorStore_externalId_key" ON "MinimartLocatorStore"("externalId");
CREATE INDEX "MinimartLocatorStore_city_idx" ON "MinimartLocatorStore"("city");
CREATE INDEX "MinimartLocatorStore_status_idx" ON "MinimartLocatorStore"("status");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

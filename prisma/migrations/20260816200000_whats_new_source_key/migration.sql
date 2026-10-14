-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_WhatsNewItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sourceKey" TEXT,
    "titleEn" TEXT NOT NULL,
    "titleBg" TEXT NOT NULL,
    "href" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_WhatsNewItem" ("id", "titleEn", "titleBg", "href", "active", "sortOrder", "createdAt", "updatedAt")
SELECT "id", "titleEn", "titleBg", "href", "active", "sortOrder", "createdAt", "updatedAt" FROM "WhatsNewItem";
DROP TABLE "WhatsNewItem";
ALTER TABLE "new_WhatsNewItem" RENAME TO "WhatsNewItem";
CREATE UNIQUE INDEX "WhatsNewItem_sourceKey_key" ON "WhatsNewItem"("sourceKey");
CREATE INDEX "WhatsNewItem_active_sortOrder_idx" ON "WhatsNewItem"("active", "sortOrder");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
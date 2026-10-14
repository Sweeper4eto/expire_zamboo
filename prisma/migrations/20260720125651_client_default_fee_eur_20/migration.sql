-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Client" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "additionalInfo" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "homeUser" BOOLEAN NOT NULL DEFAULT false,
    "monthlyFeePerStore" REAL NOT NULL DEFAULT 20,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Client" ("active", "additionalInfo", "createdAt", "homeUser", "id", "monthlyFeePerStore", "name", "phone", "updatedAt") SELECT "active", "additionalInfo", "createdAt", "homeUser", "id", "monthlyFeePerStore", "name", "phone", "updatedAt" FROM "Client";
DROP TABLE "Client";
ALTER TABLE "new_Client" RENAME TO "Client";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

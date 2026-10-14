-- Make SupportRequest.userId optional for guest contact forms.
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_SupportRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "clientId" TEXT,
    "storeId" TEXT,
    "topic" TEXT NOT NULL,
    "contact" TEXT,
    "message" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'new',
    "adminNote" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "resolvedAt" DATETIME,
    CONSTRAINT "SupportRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SupportRequest_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "SupportRequest_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_SupportRequest" ("id", "userId", "clientId", "storeId", "topic", "contact", "message", "status", "adminNote", "createdAt", "updatedAt", "resolvedAt")
SELECT "id", "userId", "clientId", "storeId", "topic", "contact", "message", "status", "adminNote", "createdAt", "updatedAt", "resolvedAt" FROM "SupportRequest";
DROP TABLE "SupportRequest";
ALTER TABLE "new_SupportRequest" RENAME TO "SupportRequest";
CREATE INDEX "SupportRequest_status_createdAt_idx" ON "SupportRequest"("status", "createdAt");
CREATE INDEX "SupportRequest_storeId_createdAt_idx" ON "SupportRequest"("storeId", "createdAt");
CREATE INDEX "SupportRequest_userId_createdAt_idx" ON "SupportRequest"("userId", "createdAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
-- CreateTable
CREATE TABLE "DocumentOcrScan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DocumentOcrScan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "DocumentOcrScan_createdAt_idx" ON "DocumentOcrScan"("createdAt");

-- CreateIndex
CREATE INDEX "DocumentOcrScan_userId_createdAt_idx" ON "DocumentOcrScan"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "DocumentOcrScan_storeId_createdAt_idx" ON "DocumentOcrScan"("storeId", "createdAt");

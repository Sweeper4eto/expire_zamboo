-- CreateTable
CREATE TABLE "WhatsNewSeen" (
    "userId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "seenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("userId", "itemId"),
    CONSTRAINT "WhatsNewSeen_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WhatsNewSeen_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "WhatsNewItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "WhatsNewSeen_itemId_idx" ON "WhatsNewSeen"("itemId");

-- CreateTable
CREATE TABLE "StoreScheduleWeek" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "storeId" TEXT NOT NULL,
    "weekStart" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'auto',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "finalizedAt" DATETIME,
    "finalizedByUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StoreScheduleWeek_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StoreScheduleWeek_finalizedByUserId_fkey" FOREIGN KEY ("finalizedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SchedulePreference" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "weekId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dayIndex" INTEGER NOT NULL,
    "startMin" INTEGER NOT NULL,
    "endMin" INTEGER NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SchedulePreference_weekId_fkey" FOREIGN KEY ("weekId") REFERENCES "StoreScheduleWeek" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SchedulePreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ScheduleShift" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "weekId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dayIndex" INTEGER NOT NULL,
    "startMin" INTEGER NOT NULL,
    "endMin" INTEGER NOT NULL,
    CONSTRAINT "ScheduleShift_weekId_fkey" FOREIGN KEY ("weekId") REFERENCES "StoreScheduleWeek" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ScheduleShift_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "StoreScheduleWeek_storeId_weekStart_key" ON "StoreScheduleWeek"("storeId", "weekStart");

-- CreateIndex
CREATE INDEX "StoreScheduleWeek_storeId_idx" ON "StoreScheduleWeek"("storeId");

-- CreateIndex
CREATE UNIQUE INDEX "SchedulePreference_weekId_userId_dayIndex_key" ON "SchedulePreference"("weekId", "userId", "dayIndex");

-- CreateIndex
CREATE INDEX "SchedulePreference_userId_idx" ON "SchedulePreference"("userId");

-- CreateIndex
CREATE INDEX "ScheduleShift_weekId_dayIndex_idx" ON "ScheduleShift"("weekId", "dayIndex");

-- CreateIndex
CREATE INDEX "ScheduleShift_userId_idx" ON "ScheduleShift"("userId");

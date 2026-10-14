-- CreateTable
CREATE TABLE "ScheduleDayExclusion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "weekId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dayIndex" INTEGER NOT NULL,
    CONSTRAINT "ScheduleDayExclusion_weekId_fkey" FOREIGN KEY ("weekId") REFERENCES "StoreScheduleWeek" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ScheduleDayExclusion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "ScheduleDayExclusion_weekId_userId_dayIndex_key" ON "ScheduleDayExclusion"("weekId", "userId", "dayIndex");

-- CreateIndex
CREATE INDEX "ScheduleDayExclusion_weekId_dayIndex_idx" ON "ScheduleDayExclusion"("weekId", "dayIndex");

-- CreateIndex
CREATE INDEX "ScheduleDayExclusion_userId_idx" ON "ScheduleDayExclusion"("userId");

-- Drop legacy global participant flag
ALTER TABLE "User" DROP COLUMN "scheduleParticipant";

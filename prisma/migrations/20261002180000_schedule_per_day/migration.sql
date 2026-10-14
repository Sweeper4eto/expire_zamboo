-- CreateTable
CREATE TABLE "StoreScheduleDay" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "weekId" TEXT NOT NULL,
    "dayIndex" INTEGER NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'auto',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "finalizedAt" DATETIME,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StoreScheduleDay_weekId_fkey" FOREIGN KEY ("weekId") REFERENCES "StoreScheduleWeek" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "StoreScheduleDay_weekId_dayIndex_key" ON "StoreScheduleDay"("weekId", "dayIndex");

-- CreateIndex
CREATE INDEX "StoreScheduleDay_weekId_idx" ON "StoreScheduleDay"("weekId");

-- Backfill 7 days for existing weeks (inherit week mode/status)
INSERT INTO "StoreScheduleDay" ("id", "weekId", "dayIndex", "mode", "status", "finalizedAt", "updatedAt")
SELECT
  lower(hex(randomblob(16))),
  w."id",
  d.dayIndex,
  w."mode",
  w."status",
  CASE WHEN w."status" = 'FINALIZED' THEN w."finalizedAt" ELSE NULL END,
  CURRENT_TIMESTAMP
FROM "StoreScheduleWeek" w
CROSS JOIN (
  SELECT 0 AS dayIndex UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3
  UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6
) d;

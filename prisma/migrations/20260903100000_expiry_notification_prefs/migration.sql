-- Expiry push notification preferences (user + client defaults)
ALTER TABLE "User" ADD COLUMN "expiryNotifyEarlyEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "User" ADD COLUMN "expiryNotifyEarlyDays" INTEGER NOT NULL DEFAULT 14;
ALTER TABLE "User" ADD COLUMN "expiryNotifyUrgentEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "User" ADD COLUMN "expiryNotifyUrgentDays" INTEGER NOT NULL DEFAULT 3;
ALTER TABLE "User" ADD COLUMN "expiryNotifySchedule" TEXT NOT NULL DEFAULT 'daily';
ALTER TABLE "User" ADD COLUMN "expiryNotifyTime1" TEXT NOT NULL DEFAULT '09:00';
ALTER TABLE "User" ADD COLUMN "expiryNotifyTime2" TEXT NOT NULL DEFAULT '18:00';
ALTER TABLE "User" ADD COLUMN "expiryNotifyMinIntervalHours" INTEGER NOT NULL DEFAULT 24;
ALTER TABLE "User" ADD COLUMN "expiryQuietHoursEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "User" ADD COLUMN "expiryQuietHoursStart" TEXT NOT NULL DEFAULT '22:00';
ALTER TABLE "User" ADD COLUMN "expiryQuietHoursEnd" TEXT NOT NULL DEFAULT '07:00';
ALTER TABLE "User" ADD COLUMN "expiryNotifyTimezone" TEXT NOT NULL DEFAULT 'Europe/Sofia';
ALTER TABLE "User" ADD COLUMN "expiryNotifyStoreIdsJson" TEXT;
ALTER TABLE "User" ADD COLUMN "expiryNotifyPrefsCustomized" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Client" ADD COLUMN "expiryDefaultEarlyDays" INTEGER;
ALTER TABLE "Client" ADD COLUMN "expiryDefaultUrgentDays" INTEGER;
ALTER TABLE "Client" ADD COLUMN "expiryDefaultSchedule" TEXT;
ALTER TABLE "Client" ADD COLUMN "expiryDefaultTime1" TEXT;
ALTER TABLE "Client" ADD COLUMN "expiryDefaultTime2" TEXT;
ALTER TABLE "Client" ADD COLUMN "expiryDefaultMinIntervalHours" INTEGER;
ALTER TABLE "Client" ADD COLUMN "expiryDefaultQuietEnabled" BOOLEAN;
ALTER TABLE "Client" ADD COLUMN "expiryDefaultQuietStart" TEXT;
ALTER TABLE "Client" ADD COLUMN "expiryDefaultQuietEnd" TEXT;
ALTER TABLE "Client" ADD COLUMN "expiryDefaultTimezone" TEXT;

-- CreateTable
CREATE TABLE "AppConfig" (
    "id" INTEGER NOT NULL PRIMARY KEY DEFAULT 1,
    "paymentsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO "AppConfig" ("id", "paymentsEnabled", "updatedAt")
VALUES (1, false, CURRENT_TIMESTAMP);

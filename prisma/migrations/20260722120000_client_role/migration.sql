-- AlterTable
ALTER TABLE "User" ADD COLUMN "clientRole" TEXT;

-- Existing assigned users become MEMBERs; oldest user per client becomes OWNER.
UPDATE "User" SET "clientRole" = 'MEMBER' WHERE "clientId" IS NOT NULL;

UPDATE "User"
SET "clientRole" = 'OWNER'
WHERE "id" IN (
  SELECT u."id"
  FROM "User" u
  INNER JOIN (
    SELECT "clientId", MIN("createdAt") AS "firstAt"
    FROM "User"
    WHERE "clientId" IS NOT NULL
    GROUP BY "clientId"
  ) first_user
    ON first_user."clientId" = u."clientId"
   AND first_user."firstAt" = u."createdAt"
  WHERE u."clientId" IS NOT NULL
);
import { execSync } from "node:child_process";
import path from "node:path";
import type { PrismaClient } from "@/generated/prisma/client";

export const TEST_DB_PATH = path.join(process.cwd(), "prisma", "test.db");
export const TEST_DATABASE_URL = `file:${TEST_DB_PATH.replace(/\\/g, "/")}`;

export function setupTestEnv(): void {
  process.env.DATABASE_URL = TEST_DATABASE_URL;
  process.env.SESSION_SECRET = "test-session-secret-32chars!!";
  process.env.CRON_SECRET = "test-cron-secret";
  process.env.TEST_MODE = "1";
}

export function migrateTestDb(): void {
  execSync("npx prisma migrate deploy", {
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
    stdio: "pipe",
  });
}

export async function resetTestDb(db: PrismaClient): Promise<void> {
  // Schedule / audit / OCR first so FK order never blocks store/user wipes.
  await db.scheduleShift.deleteMany();
  await db.scheduleDayExclusion.deleteMany();
  await db.storeScheduleDay.deleteMany();
  await db.storeScheduleWeek.deleteMany();
  await db.documentOcrScan.deleteMany();
  await db.zambooItem.deleteMany();
  await db.zambooSyncState.deleteMany();
  await db.auditLog.deleteMany();
  await db.payment.deleteMany();
  await db.buyListEntry.deleteMany();
  await db.inventoryEntry.deleteMany();
  await db.userStore.deleteMany();
  await db.product.deleteMany();
  await db.store.deleteMany();
  await db.user.deleteMany();
  await db.client.deleteMany();
}

export async function seedAdmin(db: PrismaClient) {
  const { hashPassword } = await import("@/lib/password");
  return db.user.upsert({
    where: { username: "admin" },
    update: {},
    create: {
      username: "admin",
      passwordHash: await hashPassword("admin123"),
      role: "ADMIN",
    },
  });
}

export async function seedClientWithStore(db: PrismaClient) {
  const client = await db.client.create({
    data: {
      name: "Test Client",
      monthlyFeePerStore: 20,
      stores: { create: { name: "Store A", monthlyFee: 20 } },
    },
    include: { stores: true },
  });
  return client;
}

export async function seedUserWithAccess(
  db: PrismaClient,
  clientId: string,
  storeId: string,
  username?: string,
) {
  const { hashPassword } = await import("@/lib/password");
  const resolvedUsername = username ?? `worker-${Date.now()}`;
  const user = await db.user.create({
    data: {
      username: resolvedUsername,
      passwordHash: await hashPassword("password123"),
      role: "USER",
      clientId,
      storeLinks: { create: { storeId } },
    },
  });
  return user;
}

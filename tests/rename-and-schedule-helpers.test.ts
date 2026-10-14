import test from "node:test";
import assert from "node:assert/strict";
import { auditUserUpdated } from "../src/lib/audit-details";
import { parseScheduleAccess } from "../src/lib/schedule";
import {
  parseUsernameChange,
  syncDenormalizedUsername,
  usernameIsTaken,
} from "../src/lib/rename-username";
import type { PrismaClient } from "@/generated/prisma/client";
import {
  migrateTestDb,
  resetTestDb,
  seedAdmin,
  seedClientWithStore,
  setupTestEnv,
} from "./helpers/db";

setupTestEnv();
migrateTestDb();

test("parseScheduleAccess defaults unknown values to private", () => {
  assert.equal(parseScheduleAccess("public"), "public");
  assert.equal(parseScheduleAccess("private"), "private");
  assert.equal(parseScheduleAccess("disabled"), "disabled");
  assert.equal(parseScheduleAccess(undefined), "private");
  assert.equal(parseScheduleAccess("weird"), "private");
});

test("auditUserUpdated records username renames", () => {
  const details = auditUserUpdated(
    {
      username: "old_name",
      active: true,
      clientName: "Shop",
      storeNames: ["Main"],
      clientRole: "MEMBER",
    },
    {
      username: "new_name",
      active: true,
      clientName: "Shop",
      storeNames: ["Main"],
      clientRole: "MEMBER",
    },
  );
  assert.match(details, /username old_name → new_name/);
  assert.match(details, /user "new_name"/);
});

test("parseUsernameChange skips undefined and unchanged names", () => {
  assert.deepEqual(parseUsernameChange(undefined, "alice"), {
    ok: true,
    username: null,
  });
  assert.deepEqual(parseUsernameChange("Alice", "alice"), {
    ok: true,
    username: null,
  });
});

test("parseUsernameChange validates and normalizes renames", () => {
  assert.equal(parseUsernameChange("ab", "alice").ok, false);
  assert.equal(parseUsernameChange("Bad Name!", "alice").ok, false);
  assert.deepEqual(parseUsernameChange("Bob_1", "alice"), {
    ok: true,
    username: "bob_1",
  });
});

let db: PrismaClient;

test.before(async () => {
  ({ db } = await import("../src/lib/db"));
});

test.beforeEach(async () => {
  await resetTestDb(db);
  await seedAdmin(db);
});

test("usernameIsTaken and syncDenormalizedUsername keep audit/OCR in sync", async () => {
  const client = await seedClientWithStore(db);
  const store = client.stores[0]!;
  const { hashPassword } = await import("../src/lib/password");
  const user = await db.user.create({
    data: {
      username: "sync_me",
      passwordHash: await hashPassword("password123"),
      role: "USER",
      clientId: client.id,
    },
  });

  assert.equal(await usernameIsTaken(db, "admin", user.id), true);
  assert.equal(await usernameIsTaken(db, "sync_me", user.id), false);
  assert.equal(await usernameIsTaken(db, "fresh_name", user.id), false);

  await db.auditLog.create({
    data: {
      userId: user.id,
      username: "sync_me",
      event: "login",
      details: "before rename",
    },
  });
  await db.documentOcrScan.create({
    data: {
      userId: user.id,
      username: "sync_me",
      storeId: store.id,
    },
  });

  await db.user.update({
    where: { id: user.id },
    data: { username: "synced_user" },
  });
  await syncDenormalizedUsername(db, user.id, "synced_user");

  const audits = await db.auditLog.findMany({ where: { userId: user.id } });
  assert.ok(audits.every((row) => row.username === "synced_user"));
  const scans = await db.documentOcrScan.findMany({ where: { userId: user.id } });
  assert.ok(scans.every((row) => row.username === "synced_user"));
});

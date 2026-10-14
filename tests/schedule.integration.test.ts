import test from "node:test";
import assert from "node:assert/strict";
import type { PrismaClient } from "@/generated/prisma/client";
import {
  clearMockCookie,
  setMockSession,
} from "./helpers/mock-cookies";
import {
  migrateTestDb,
  resetTestDb,
  seedAdmin,
  seedClientWithStore,
  seedUserWithAccess,
  setupTestEnv,
} from "./helpers/db";
import { mondayOfWeek, SCHEDULE_CLOSE_MIN, SCHEDULE_OPEN_MIN } from "../src/lib/schedule";

setupTestEnv();
migrateTestDb();

let db: PrismaClient;
let loginUser: typeof import("../src/lib/auth").loginUser;
let scheduleGet: (request: Request) => Promise<Response>;
let schedulePatch: (request: Request) => Promise<Response>;
let schedulePut: ((request: Request) => Promise<Response>) | undefined;
let scheduleAccessGet: (request: Request) => Promise<Response>;
let scheduleAccessPatch: (request: Request) => Promise<Response>;

async function jsonRequest(
  handler: (request: Request) => Promise<Response>,
  init: RequestInit & { url?: string } = {},
) {
  const response = await handler(
    new Request(init.url ?? "http://localhost/api", init),
  );
  const data = await response.json().catch(() => null);
  return { response, data };
}

test.before(async () => {
  ({ db } = await import("../src/lib/db"));
  ({ loginUser } = await import("../src/lib/auth"));
  const scheduleRoute = await import("../src/app/api/schedule/route");
  scheduleGet = scheduleRoute.GET;
  schedulePatch = scheduleRoute.PATCH;
  schedulePut = scheduleRoute.PUT;
  ({ GET: scheduleAccessGet, PATCH: scheduleAccessPatch } = await import(
    "../src/app/api/team/schedule-access/route"
  ));
});

test.beforeEach(async () => {
  clearMockCookie();
  await resetTestDb(db);
  await seedAdmin(db);
});

async function seedScheduleTeam(access: "private" | "public" | "disabled" = "public") {
  const client = await seedClientWithStore(db);
  await db.client.update({
    where: { id: client.id },
    data: { scheduleAccess: access, scheduleEnabled: true },
  });
  const store = client.stores[0]!;
  const owner = await seedUserWithAccess(db, client.id, store.id, "sched_owner");
  await db.user.update({
    where: { id: owner.id },
    data: { clientRole: "OWNER" },
  });
  const member = await seedUserWithAccess(db, client.id, store.id, "sched_member");
  await db.user.update({
    where: { id: member.id },
    data: { clientRole: "MEMBER" },
  });
  return { client, store, owner, member, weekStart: mondayOfWeek() };
}

test("schedule PUT desired-hours endpoint is removed", () => {
  assert.equal(typeof schedulePut, "undefined");
});

test("GET /api/schedule returns week without preferences for owners", async () => {
  const { store, weekStart } = await seedScheduleTeam("private");
  const login = await loginUser("sched_owner", "password123");
  assert.equal(login.ok, true);
  if (!login.ok) return;
  await setMockSession(login.token);

  const { response, data } = await jsonRequest(scheduleGet, {
    url: `http://localhost/api/schedule?storeId=${store.id}&weekStart=${weekStart}`,
  });
  assert.equal(response.status, 200);
  assert.equal(data.week.storeId, store.id);
  assert.equal(data.week.weekStart, weekStart);
  assert.equal(data.me.isOwner, true);
  assert.ok(Array.isArray(data.days));
  assert.equal(data.days.length, 7);
  assert.ok(Array.isArray(data.shifts));
  assert.equal(Object.hasOwn(data, "preferences"), false);
});

test("GET /api/schedule blocks members when access is private", async () => {
  const { store, weekStart } = await seedScheduleTeam("private");
  const login = await loginUser("sched_member", "password123");
  assert.equal(login.ok, true);
  if (!login.ok) return;
  await setMockSession(login.token);

  const { response } = await jsonRequest(scheduleGet, {
    url: `http://localhost/api/schedule?storeId=${store.id}&weekStart=${weekStart}`,
  });
  assert.equal(response.status, 403);
});

test("GET /api/schedule allows members when access is public", async () => {
  const { store, weekStart } = await seedScheduleTeam("public");
  const login = await loginUser("sched_member", "password123");
  assert.equal(login.ok, true);
  if (!login.ok) return;
  await setMockSession(login.token);

  const { response, data } = await jsonRequest(scheduleGet, {
    url: `http://localhost/api/schedule?storeId=${store.id}&weekStart=${weekStart}`,
  });
  assert.equal(response.status, 200);
  assert.equal(data.me.isOwner, false);
  assert.equal(Object.hasOwn(data, "preferences"), false);
});

test("PATCH runAuto fills equal shifts without preferences", async () => {
  const { store, owner, member, weekStart } = await seedScheduleTeam("public");
  const login = await loginUser("sched_owner", "password123");
  assert.equal(login.ok, true);
  if (!login.ok) return;
  await setMockSession(login.token);

  const dayIndex = 0;
  const { response, data } = await jsonRequest(schedulePatch, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      storeId: store.id,
      weekStart,
      dayIndex,
      action: "runAuto",
    }),
  });
  assert.equal(response.status, 200, JSON.stringify(data));
  const dayShifts = (data.shifts as { userId: string; dayIndex: number; startMin: number; endMin: number }[])
    .filter((s) => s.dayIndex === dayIndex)
    .sort((a, b) => a.startMin - b.startMin);
  assert.equal(dayShifts.length, 2);
  const ids = new Set(dayShifts.map((s) => s.userId));
  assert.ok(ids.has(owner.id));
  assert.ok(ids.has(member.id));
  assert.equal(Math.min(...dayShifts.map((s) => s.startMin)), SCHEDULE_OPEN_MIN);
  assert.equal(Math.max(...dayShifts.map((s) => s.endMin)), SCHEDULE_CLOSE_MIN);
  assert.equal(Object.hasOwn(data, "preferences"), false);
});

test("PATCH setParticipant excludes member and clears their shift", async () => {
  const { store, member, weekStart } = await seedScheduleTeam("public");
  const login = await loginUser("sched_owner", "password123");
  assert.equal(login.ok, true);
  if (!login.ok) return;
  await setMockSession(login.token);

  const dayIndex = 2;
  await jsonRequest(schedulePatch, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      storeId: store.id,
      weekStart,
      dayIndex,
      action: "runAuto",
    }),
  });

  const excluded = await jsonRequest(schedulePatch, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      storeId: store.id,
      weekStart,
      dayIndex,
      action: "setParticipant",
      userId: member.id,
      scheduleParticipant: false,
    }),
  });
  assert.equal(excluded.response.status, 200);
  const day = excluded.data.days.find((d: { dayIndex: number }) => d.dayIndex === dayIndex);
  assert.ok(day.excludedUserIds.includes(member.id));
  assert.equal(
    excluded.data.shifts.some(
      (s: { userId: string; dayIndex: number }) =>
        s.userId === member.id && s.dayIndex === dayIndex,
    ),
    false,
  );
});

test("PATCH finalize locks the day for members; reopen unlocks", async () => {
  const { store, weekStart } = await seedScheduleTeam("public");
  const ownerLogin = await loginUser("sched_owner", "password123");
  assert.equal(ownerLogin.ok, true);
  if (!ownerLogin.ok) return;
  await setMockSession(ownerLogin.token);

  const dayIndex = 1;
  const finalized = await jsonRequest(schedulePatch, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      storeId: store.id,
      weekStart,
      dayIndex,
      action: "finalize",
    }),
  });
  assert.equal(finalized.response.status, 200);
  assert.equal(
    finalized.data.days.find((d: { dayIndex: number }) => d.dayIndex === dayIndex)
      ?.status,
    "FINALIZED",
  );

  const locked = await jsonRequest(schedulePatch, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      storeId: store.id,
      weekStart,
      dayIndex,
      action: "runAuto",
    }),
  });
  assert.equal(locked.response.status, 409);

  const reopened = await jsonRequest(schedulePatch, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      storeId: store.id,
      weekStart,
      dayIndex,
      action: "reopen",
    }),
  });
  assert.equal(reopened.response.status, 200);
  assert.equal(
    reopened.data.days.find((d: { dayIndex: number }) => d.dayIndex === dayIndex)
      ?.status,
    "DRAFT",
  );
});

test("members cannot PATCH schedule", async () => {
  const { store, weekStart } = await seedScheduleTeam("public");
  const login = await loginUser("sched_member", "password123");
  assert.equal(login.ok, true);
  if (!login.ok) return;
  await setMockSession(login.token);

  const { response } = await jsonRequest(schedulePatch, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      storeId: store.id,
      weekStart,
      dayIndex: 0,
      action: "runAuto",
    }),
  });
  assert.equal(response.status, 403);
});

test("team schedule-access can switch public/private/disabled", async () => {
  const { client } = await seedScheduleTeam("private");
  const login = await loginUser("sched_owner", "password123");
  assert.equal(login.ok, true);
  if (!login.ok) return;
  await setMockSession(login.token);

  const current = await jsonRequest(scheduleAccessGet, {
    url: "http://localhost/api/team/schedule-access",
  });
  assert.equal(current.response.status, 200);
  assert.equal(current.data.scheduleAccess, "private");

  const toPublic = await jsonRequest(scheduleAccessPatch, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ scheduleAccess: "public" }),
  });
  assert.equal(toPublic.response.status, 200);
  assert.equal(toPublic.data.scheduleAccess, "public");

  const stored = await db.client.findUnique({ where: { id: client.id } });
  assert.equal(stored?.scheduleAccess, "public");
});

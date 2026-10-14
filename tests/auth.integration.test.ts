import test from "node:test";
import assert from "node:assert/strict";
import type { PrismaClient } from "@/generated/prisma/client";
import {
  migrateTestDb,
  resetTestDb,
  seedAdmin,
  seedClientWithStore,
  seedUserWithAccess,
  setupTestEnv,
} from "./helpers/db";

setupTestEnv();
migrateTestDb();

let db: PrismaClient;
let registerUser: typeof import("../src/lib/auth").registerUser;
let loginUser: typeof import("../src/lib/auth").loginUser;
let purgeExpiredInventory: typeof import("../src/lib/inventory-purge").purgeExpiredInventory;

test.before(async () => {
  ({ db } = await import("../src/lib/db"));
  ({ registerUser, loginUser } = await import("../src/lib/auth"));
  ({ purgeExpiredInventory } = await import("../src/lib/inventory-purge"));
});

test.beforeEach(async () => {
  await resetTestDb(db);
  await seedAdmin(db);
});

const registerOpts = { accountType: "home" as const };

test("registerUser validates username and password length", async () => {
  const shortName = await registerUser("ab", "password123", registerOpts);
  assert.equal(shortName.ok, false);
  if (!shortName.ok) assert.equal(shortName.errorKey, "auth.usernameTooShort");

  const emptyPass = await registerUser("validuser", "", registerOpts);
  assert.equal(emptyPass.ok, false);
  if (!emptyPass.ok) assert.equal(emptyPass.errorKey, "auth.passwordRequired");
});

test("registerUser rejects duplicate usernames", async () => {
  const first = await registerUser("duplicate", "password123", registerOpts);
  assert.equal(first.ok, true);

  const second = await registerUser("Duplicate", "password123", registerOpts);
  assert.equal(second.ok, false);
  if (!second.ok) assert.equal(second.errorKey, "auth.usernameTaken");
});

test("registerUser home creates Home; retail creates Main", async () => {
  const home = await registerUser("homeowner1", "password123", {
    accountType: "home",
  });
  assert.equal(home.ok, true);
  if (!home.ok) return;

  const homeStores = await db.store.findMany({
    where: { clientId: home.user.clientId! },
  });
  assert.equal(homeStores.length, 1);
  assert.equal(homeStores[0]?.name, "Home");
  const homeLinks = await db.userStore.count({
    where: { userId: home.user.id },
  });
  assert.equal(homeLinks, 1);

  const retail = await registerUser("bizowner1", "password123", {
    accountType: "retail",
  });
  assert.equal(retail.ok, true);
  if (!retail.ok) return;

  const retailStores = await db.store.findMany({
    where: { clientId: retail.user.clientId! },
  });
  assert.equal(retailStores.length, 1);
  assert.equal(retailStores[0]?.name, "Main");
  const retailLinks = await db.userStore.count({
    where: { userId: retail.user.id },
  });
  assert.equal(retailLinks, 1);
  assert.ok(retail.user.clientId);
});

test("loginUser rejects user without client assignment", async () => {
  const { hashPassword } = await import("../src/lib/password");
  await db.user.create({
    data: {
      username: "newuser",
      passwordHash: await hashPassword("password123"),
      role: "USER",
    },
  });
  const result = await loginUser("newuser", "password123");
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.code, "NO_CLIENT");
    assert.equal(result.errorKey, "auth.noClientAssigned");
  }
});

test("loginUser succeeds for assigned user with store access", async () => {
  const client = await seedClientWithStore(db);
  const store = client.stores[0];
  const user = await seedUserWithAccess(db, client.id, store.id);

  const result = await loginUser(user.username, "password123");
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.user.username, user.username);
    assert.ok(result.token.length > 0);
  }
});

test("loginUser rejects invalid credentials", async () => {
  const result = await loginUser("nobody", "wrong");
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.errorKey, "auth.invalidCredentials");
});

test("purgeExpiredInventory hard-deletes expiry removals older than one month", async () => {
  const client = await seedClientWithStore(db);
  const store = client.stores[0];
  const product = await db.product.create({
    data: { barcode: "123", name: "Milk" },
  });

  const oldRemoval = new Date();
  oldRemoval.setDate(oldRemoval.getDate() - 31);
  const recentRemoval = new Date();
  recentRemoval.setDate(recentRemoval.getDate() - 7);

  await db.inventoryEntry.create({
    data: {
      storeId: store.id,
      productId: product.id,
      barcode: product.barcode,
      quantity: 1,
      expiryDate: new Date(),
      removedAt: oldRemoval,
    },
  });
  await db.inventoryEntry.create({
    data: {
      storeId: store.id,
      productId: product.id,
      barcode: product.barcode,
      quantity: 2,
      expiryDate: new Date(),
      removedAt: recentRemoval,
    },
  });
  await db.inventoryEntry.create({
    data: {
      storeId: store.id,
      productId: product.id,
      barcode: product.barcode,
      quantity: 3,
      expiryDate: new Date("2025-01-01"),
    },
  });

  const purged = await purgeExpiredInventory();
  assert.equal(purged, 1);

  const remaining = await db.inventoryEntry.findMany({
    orderBy: { quantity: "asc" },
  });
  assert.equal(remaining.length, 2);
  assert.equal(remaining[0]?.quantity, 2);
  assert.ok(remaining[0]?.removedAt);
  assert.equal(remaining[1]?.quantity, 3);
  assert.equal(remaining[1]?.removedAt, null);
});

test.after(async () => {
  await db.$disconnect();
});

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

setupTestEnv();
migrateTestDb();

let db: PrismaClient;
let loginUser: typeof import("../src/lib/auth").loginUser;
let registerPost: (request: Request) => Promise<Response>;
let loginPost: (request: Request) => Promise<Response>;
let productsGet: (request: Request) => Promise<Response>;
let productsPost: (request: Request) => Promise<Response>;
let inventoryPost: (request: Request) => Promise<Response>;
let inventoryGet: (request: Request) => Promise<Response>;
let inventoryPatch: (request: Request) => Promise<Response>;
let cronPost: (request: Request) => Promise<Response>;
let clientsGet: (request: Request) => Promise<Response>;
let clientsPost: (request: Request) => Promise<Response>;
let clientsPatch: (request: Request) => Promise<Response>;
let usersGet: (request: Request) => Promise<Response>;
let usersPatch: (request: Request) => Promise<Response>;
let usersDelete: (request: Request) => Promise<Response>;
let paymentsPost: (request: Request) => Promise<Response>;
let calendarGet: (request: Request) => Promise<Response>;
let adminProductsPatch: (request: Request) => Promise<Response>;
let adminProductsDelete: (request: Request) => Promise<Response>;
let meGet: (request: Request) => Promise<Response>;
let buyListGet: (request: Request) => Promise<Response>;
let buyListPost: (request: Request) => Promise<Response>;
let buyListPatch: (request: Request) => Promise<Response>;
let teamPatch: (request: Request) => Promise<Response>;

async function jsonRequest(
  handler: (request: Request) => Promise<Response>,
  init: RequestInit & { url?: string } = {},
) {
  const response = await handler(
    new Request(init.url ?? "http://localhost/api", init),
  );
  const data = await response.json();
  return { response, data };
}

test.before(async () => {
  ({ db } = await import("../src/lib/db"));
  ({ loginUser } = await import("../src/lib/auth"));
  ({ POST: registerPost } = await import("../src/app/api/auth/register/route"));
  ({ POST: loginPost } = await import("../src/app/api/auth/login/route"));
  ({ GET: productsGet, POST: productsPost } = await import(
    "../src/app/api/products/route"
  ));
  ({ POST: inventoryPost, GET: inventoryGet, PATCH: inventoryPatch } =
    await import("../src/app/api/inventory/route"));
  ({ POST: cronPost } = await import("../src/app/api/cron/purge-inventory/route"));
  ({ GET: clientsGet, POST: clientsPost, PATCH: clientsPatch } = await import(
    "../src/app/api/admin/clients/route"
  ));
  ({ GET: usersGet, PATCH: usersPatch, DELETE: usersDelete } = await import(
    "../src/app/api/admin/users/route"
  ));
  ({ POST: paymentsPost } = await import("../src/app/api/admin/payments/route"));
  ({ GET: calendarGet } = await import(
    "../src/app/api/admin/payments/calendar/route"
  ));
  ({ PATCH: adminProductsPatch, DELETE: adminProductsDelete } = await import(
    "../src/app/api/admin/products/route"
  ));
  ({ GET: meGet } = await import("../src/app/api/auth/me/route"));
  ({ GET: buyListGet, POST: buyListPost, PATCH: buyListPatch } = await import(
    "../src/app/api/buy-list/route"
  ));
  ({ PATCH: teamPatch } = await import("../src/app/api/team/users/route"));
});

test.beforeEach(async () => {
  clearMockCookie();
  await resetTestDb(db);
  await seedAdmin(db);
});

test("POST /api/auth/register creates user and returns English message", async () => {
  const { response, data } = await jsonRequest(registerPost, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: "newbie",
      password: "password123",
      accountType: "home",
    }),
  });

  assert.equal(response.status, 200);
  assert.equal(data.user.username, "newbie");
  assert.match(data.message, /signed in/i);
});

test("POST /api/auth/login sets session for admin", async () => {
  const { response, data } = await jsonRequest(loginPost, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "admin", password: "admin123" }),
  });

  assert.equal(response.status, 200);
  assert.equal(data.user.role, "ADMIN");
});

test("products API requires authentication", async () => {
  const { response } = await jsonRequest(productsGet, {
    url: "http://localhost/api/products?barcode=123",
  });
  assert.equal(response.status, 401);
});

test("product lookup matches UPC-A and EAN-13 barcodes", async () => {
  const client = await seedClientWithStore(db);
  const store = client.stores[0];
  const user = await seedUserWithAccess(db, client.id, store.id);

  const login = await loginUser(user.username, "password123");
  assert.equal(login.ok, true);
  if (!login.ok) return;
  await setMockSession(login.token);

  const createProduct = await jsonRequest(productsPost, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ barcode: "400229340110", name: "UPC Product" }),
  });
  assert.equal(createProduct.response.status, 201);
  assert.equal(createProduct.data.product.barcode, "0400229340110");

  const lookupUpc = await jsonRequest(productsGet, {
    url: "http://localhost/api/products?barcode=400229340110",
  });
  assert.equal(lookupUpc.response.status, 200);
  assert.equal(lookupUpc.data.product?.name, "UPC Product");
});

test("PATCH /api/inventory updates quantity and expiry date", async () => {
  const client = await seedClientWithStore(db);
  const store = client.stores[0];
  const user = await seedUserWithAccess(db, client.id, store.id);

  const login = await loginUser(user.username, "password123");
  assert.equal(login.ok, true);
  if (!login.ok) return;
  await setMockSession(login.token);

  const createProduct = await jsonRequest(productsPost, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ barcode: "777", name: "Cheese" }),
  });
  assert.equal(createProduct.response.status, 201);

  const expiry = new Date();
  expiry.setUTCDate(expiry.getUTCDate() + 10);
  expiry.setUTCHours(0, 0, 0, 0);

  const createEntry = await jsonRequest(inventoryPost, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      storeId: store.id,
      barcode: "777",
      productId: createProduct.data.product.id,
      quantity: 2,
      expiryDate: expiry.toISOString(),
    }),
  });
  assert.equal(createEntry.response.status, 201);

  const entryId = createEntry.data.entry.id as string;

  const updateQty = await jsonRequest(inventoryPatch, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      entryId,
      storeId: store.id,
      quantity: 5,
    }),
  });
  assert.equal(updateQty.response.status, 200);
  assert.equal(updateQty.data.entry.quantity, 5);

  const newExpiry = new Date(expiry);
  newExpiry.setUTCDate(newExpiry.getUTCDate() + 3);

  const updateExpiry = await jsonRequest(inventoryPatch, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      entryId,
      storeId: store.id,
      expiryDate: newExpiry.toISOString(),
    }),
  });
  assert.equal(updateExpiry.response.status, 200);
  assert.equal(
    new Date(updateExpiry.data.entry.expiryDate).toISOString().slice(0, 10),
    newExpiry.toISOString().slice(0, 10),
  );
  assert.equal(updateExpiry.data.entry.quantity, 5);
});

test("PATCH /api/inventory marks item for price reduction", async () => {
  const client = await seedClientWithStore(db);
  const store = client.stores[0];
  const user = await seedUserWithAccess(db, client.id, store.id);

  const login = await loginUser(user.username, "password123");
  assert.equal(login.ok, true);
  if (!login.ok) return;
  await setMockSession(login.token);

  const createProduct = await jsonRequest(productsPost, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ barcode: "888", name: "Yogurt" }),
  });
  assert.equal(createProduct.response.status, 201);

  const expiry = new Date();
  expiry.setUTCDate(expiry.getUTCDate() + 5);
  expiry.setUTCHours(0, 0, 0, 0);

  const createEntry = await jsonRequest(inventoryPost, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      storeId: store.id,
      barcode: "888",
      productId: createProduct.data.product.id,
      quantity: 3,
      expiryDate: expiry.toISOString(),
    }),
  });
  assert.equal(createEntry.response.status, 201);

  const entryId = createEntry.data.entry.id as string;

  const reducePrice = await jsonRequest(inventoryPatch, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      entryId,
      storeId: store.id,
      priceReduced: true,
      priceDiscountPercent: 25,
    }),
  });
  assert.equal(reducePrice.response.status, 200);
  assert.ok(reducePrice.data.entry.priceReducedAt);
  assert.equal(reducePrice.data.entry.priceDiscountPercent, 25);
  assert.ok(reducePrice.data.entry.priceReducedByUser?.username);

  const reduceAgain = await jsonRequest(inventoryPatch, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      entryId,
      storeId: store.id,
      priceReduced: true,
      priceDiscountPercent: 50,
    }),
  });
  assert.equal(reduceAgain.response.status, 200);
  assert.notEqual(
    reduceAgain.data.entry.priceReducedAt,
    reducePrice.data.entry.priceReducedAt,
  );
  assert.equal(reduceAgain.data.entry.priceDiscountPercent, 50);
  assert.ok(reduceAgain.data.entry.priceReducedByUser?.username);

  const restorePrice = await jsonRequest(inventoryPatch, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      entryId,
      storeId: store.id,
      priceReduced: false,
    }),
  });
  assert.equal(restorePrice.response.status, 200);
  assert.equal(restorePrice.data.entry.priceReducedAt, null);
  assert.equal(restorePrice.data.entry.priceReducedByUser, null);
  assert.equal(restorePrice.data.entry.priceDiscountPercent, null);
});

test("full inventory flow via APIs", async () => {
  const client = await seedClientWithStore(db);
  const store = client.stores[0];
  const user = await seedUserWithAccess(db, client.id, store.id);

  const login = await loginUser(user.username, "password123");
  assert.equal(login.ok, true);
  if (!login.ok) return;
  await setMockSession(login.token);

  const createProduct = await jsonRequest(productsPost, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ barcode: "999", name: "Yogurt" }),
  });
  assert.equal(createProduct.response.status, 201);

  const expiry = new Date();
  expiry.setDate(expiry.getDate() + 14);

  const createEntry = await jsonRequest(inventoryPost, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      storeId: store.id,
      barcode: "999",
      productId: createProduct.data.product.id,
      quantity: 2,
      expiryDate: expiry.toISOString(),
    }),
  });
  assert.equal(createEntry.response.status, 201);

  const list = await jsonRequest(inventoryGet, {
    url: `http://localhost/api/inventory?storeId=${store.id}`,
  });
  assert.equal(list.response.status, 200);
  assert.equal(list.data.entries.length, 1);

  const remove = await jsonRequest(inventoryPatch, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      entryId: list.data.entries[0].id,
      storeId: store.id,
    }),
  });
  assert.equal(remove.response.status, 200);

  const afterRemove = await jsonRequest(inventoryGet, {
    url: `http://localhost/api/inventory?storeId=${store.id}`,
  });
  assert.equal(afterRemove.data.entries.length, 0);
});

test("POST /api/inventory merges quantity for active same product and expiry day", async () => {
  const client = await seedClientWithStore(db);
  const store = client.stores[0];
  const user = await seedUserWithAccess(db, client.id, store.id);

  const login = await loginUser(user.username, "password123");
  assert.equal(login.ok, true);
  if (!login.ok) return;
  await setMockSession(login.token);

  const createProduct = await jsonRequest(productsPost, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ barcode: "555", name: "Bread" }),
  });
  assert.equal(createProduct.response.status, 201);

  const expiry = new Date();
  expiry.setUTCDate(expiry.getUTCDate() + 14);
  expiry.setUTCHours(0, 0, 0, 0);

  const first = await jsonRequest(inventoryPost, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      storeId: store.id,
      barcode: "555",
      productId: createProduct.data.product.id,
      quantity: 2,
      expiryDate: expiry.toISOString(),
    }),
  });
  assert.equal(first.response.status, 201);
  assert.equal(first.data.merged, false);
  assert.equal(first.data.entry.quantity, 2);

  const second = await jsonRequest(inventoryPost, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      storeId: store.id,
      barcode: "555",
      productId: createProduct.data.product.id,
      quantity: 3,
      expiryDate: expiry.toISOString(),
    }),
  });
  assert.equal(second.response.status, 200);
  assert.equal(second.data.merged, true);
  assert.equal(second.data.entry.id, first.data.entry.id);
  assert.equal(second.data.entry.quantity, 5);

  const list = await jsonRequest(inventoryGet, {
    url: `http://localhost/api/inventory?storeId=${store.id}`,
  });
  assert.equal(list.data.entries.length, 1);
  assert.equal(list.data.entries[0].quantity, 5);
});

test("PATCH /api/admin/products updates barcode on all inventory entries", async () => {
  const client = await seedClientWithStore(db);
  const storeA = client.stores[0];
  const storeB = await db.store.create({
    data: { clientId: client.id, name: "Store B" },
  });
  const user = await seedUserWithAccess(db, client.id, storeA.id);
  await db.userStore.create({
    data: { userId: user.id, storeId: storeB.id },
  });

  const login = await loginUser(user.username, "password123");
  assert.equal(login.ok, true);
  if (!login.ok) return;
  await setMockSession(login.token);

  const createProduct = await jsonRequest(productsPost, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ barcode: "111222", name: "Milk" }),
  });
  assert.equal(createProduct.response.status, 201);
  const productId = createProduct.data.product.id as string;

  const expiry = new Date();
  expiry.setUTCDate(expiry.getUTCDate() + 10);
  expiry.setUTCHours(0, 0, 0, 0);

  for (const storeId of [storeA.id, storeB.id]) {
    const created = await jsonRequest(inventoryPost, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        storeId,
        barcode: "111222",
        productId,
        quantity: 1,
        expiryDate: expiry.toISOString(),
      }),
    });
    assert.equal(created.response.status, 201);
    assert.equal(created.data.entry.barcode, "111222");
  }

  const adminLogin = await loginUser("admin", "admin123");
  assert.equal(adminLogin.ok, true);
  if (!adminLogin.ok) return;
  await setMockSession(adminLogin.token);

  const updated = await jsonRequest(adminProductsPatch, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id: productId,
      barcode: "999888",
    }),
  });
  assert.equal(updated.response.status, 200);
  assert.equal(updated.data.product.barcode, "999888");

  const entries = await db.inventoryEntry.findMany({ where: { productId } });
  assert.equal(entries.length, 2);
  assert.ok(entries.every((entry) => entry.barcode === "999888"));

  await setMockSession(login.token);

  for (const storeId of [storeA.id, storeB.id]) {
    const list = await jsonRequest(inventoryGet, {
      url: `http://localhost/api/inventory?storeId=${storeId}`,
    });
    assert.equal(list.response.status, 200);
    assert.equal(list.data.entries.length, 1);
    assert.equal(list.data.entries[0].barcode, "999888");
  }

  const search = await jsonRequest(inventoryGet, {
    url: `http://localhost/api/inventory?storeId=${storeA.id}&q=999888`,
  });
  assert.equal(search.data.entries.length, 1);
});

test("DELETE /api/admin/products removes product from inventory and buy list", async () => {
  const client = await seedClientWithStore(db);
  const store = client.stores[0];
  const homeClient = await db.client.create({
    data: {
      name: "Home Client",
      monthlyFeePerStore: 10,
      homeUser: true,
      stores: { create: { name: "Home Store" } },
    },
    include: { stores: true },
  });
  const homeStore = homeClient.stores[0];
  const user = await seedUserWithAccess(db, client.id, store.id);

  const login = await loginUser(user.username, "password123");
  assert.equal(login.ok, true);
  if (!login.ok) return;
  await setMockSession(login.token);

  const createProduct = await jsonRequest(productsPost, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ barcode: "555444", name: "Yogurt" }),
  });
  assert.equal(createProduct.response.status, 201);
  const productId = createProduct.data.product.id as string;

  const expiry = new Date();
  expiry.setUTCDate(expiry.getUTCDate() + 10);
  expiry.setUTCHours(0, 0, 0, 0);

  const inventory = await jsonRequest(inventoryPost, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      storeId: store.id,
      barcode: "555444",
      productId,
      quantity: 2,
      expiryDate: expiry.toISOString(),
    }),
  });
  assert.equal(inventory.response.status, 201);

  await inventoryPatch(
    new Request("http://localhost/api/inventory", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entryId: inventory.data.entry.id, storeId: store.id }),
    }),
  );

  const homeUser = await seedUserWithAccess(
    db,
    homeClient.id,
    homeStore.id,
    "home_delete_user",
  );
  const homeLogin = await loginUser(homeUser.username, "password123");
  assert.equal(homeLogin.ok, true);
  if (!homeLogin.ok) return;
  await setMockSession(homeLogin.token);

  const buyList = await jsonRequest(buyListPost, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      storeId: homeStore.id,
      barcode: "555444",
      productId,
      quantity: 1,
    }),
  });
  assert.equal(buyList.response.status, 201);

  const adminLogin = await loginUser("admin", "admin123");
  assert.equal(adminLogin.ok, true);
  if (!adminLogin.ok) return;
  await setMockSession(adminLogin.token);

  const deleted = await jsonRequest(adminProductsDelete, {
    method: "DELETE",
    url: `http://localhost/api/admin/products?id=${productId}`,
  });
  assert.equal(deleted.response.status, 200);
  assert.equal(deleted.data.ok, true);

  assert.equal(await db.product.count({ where: { id: productId } }), 0);
  assert.equal(await db.inventoryEntry.count({ where: { productId } }), 0);
  assert.equal(await db.buyListEntry.count({ where: { productId } }), 0);
});

test("POST /api/inventory does not merge removed entries with same expiry", async () => {
  const client = await seedClientWithStore(db);
  const store = client.stores[0];
  const user = await seedUserWithAccess(db, client.id, store.id);

  const login = await loginUser(user.username, "password123");
  assert.equal(login.ok, true);
  if (!login.ok) return;
  await setMockSession(login.token);

  const createProduct = await jsonRequest(productsPost, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ barcode: "777", name: "Cheese" }),
  });

  const expiry = new Date();
  expiry.setDate(expiry.getDate() + 10);

  const created = await jsonRequest(inventoryPost, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      storeId: store.id,
      barcode: "777",
      productId: createProduct.data.product.id,
      quantity: 1,
      expiryDate: expiry.toISOString(),
    }),
  });

  await jsonRequest(inventoryPatch, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      entryId: created.data.entry.id,
      storeId: store.id,
    }),
  });

  const recreated = await jsonRequest(inventoryPost, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      storeId: store.id,
      barcode: "777",
      productId: createProduct.data.product.id,
      quantity: 4,
      expiryDate: expiry.toISOString(),
    }),
  });
  assert.equal(recreated.response.status, 201);
  assert.equal(recreated.data.merged, false);
  assert.notEqual(recreated.data.entry.id, created.data.entry.id);
  assert.equal(recreated.data.entry.quantity, 4);
});

test("inventory list filters expiry window, search, and pagination", async () => {
  const client = await seedClientWithStore(db);
  const store = client.stores[0];
  const user = await seedUserWithAccess(db, client.id, store.id);

  const login = await loginUser(user.username, "password123");
  assert.equal(login.ok, true);
  if (!login.ok) return;
  await setMockSession(login.token);

  const yogurt = await jsonRequest(productsPost, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ barcode: "111", name: "Yogurt" }),
  });
  const milk = await jsonRequest(productsPost, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ barcode: "222", name: "Milk" }),
  });

  const nearExpiry = new Date();
  nearExpiry.setDate(nearExpiry.getDate() + 10);
  const farExpiry = new Date();
  farExpiry.setDate(farExpiry.getDate() + 60);

  for (let index = 0; index < 3; index += 1) {
    await jsonRequest(inventoryPost, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        storeId: store.id,
        barcode: "111",
        productId: yogurt.data.product.id,
        quantity: 1,
        expiryDate: nearExpiry.toISOString(),
      }),
    });
  }

  await jsonRequest(inventoryPost, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      storeId: store.id,
      barcode: "222",
      productId: milk.data.product.id,
      quantity: 1,
      expiryDate: farExpiry.toISOString(),
    }),
  });

  const list = await jsonRequest(inventoryGet, {
    url: `http://localhost/api/inventory?storeId=${store.id}&page=1&limit=2`,
  });
  assert.equal(list.response.status, 200);
  assert.equal(list.data.entries.length, 1);
  assert.equal(list.data.entries[0].quantity, 3);
  assert.equal(list.data.pagination.total, 1);
  assert.equal(list.data.pagination.totalPages, 1);

  // Milk expires in 60 days — outside the 30-day window.
  const searchOutsideWindow = await jsonRequest(inventoryGet, {
    url: `http://localhost/api/inventory?storeId=${store.id}&q=Milk&withinDays=30`,
  });
  assert.equal(searchOutsideWindow.response.status, 200);
  assert.equal(searchOutsideWindow.data.entries.length, 0);

  const search = await jsonRequest(inventoryGet, {
    url: `http://localhost/api/inventory?storeId=${store.id}&q=Milk&withinDays=all`,
  });
  assert.equal(search.response.status, 200);
  assert.equal(search.data.entries.length, 1);
  assert.equal(search.data.entries[0].product.name, "Milk");

  const caseSearch = await jsonRequest(inventoryGet, {
    url: `http://localhost/api/inventory?storeId=${store.id}&q=milk&withinDays=all`,
  });
  assert.equal(caseSearch.data.entries.length, 1);

  const barcodeSearch = await jsonRequest(inventoryGet, {
    url: `http://localhost/api/inventory?storeId=${store.id}&q=111`,
  });
  assert.equal(barcodeSearch.data.entries.length, 1);
  assert.equal(barcodeSearch.data.entries[0].quantity, 3);

  const narrowWindow = await jsonRequest(inventoryGet, {
    url: `http://localhost/api/inventory?storeId=${store.id}&withinDays=30`,
  });
  assert.equal(narrowWindow.response.status, 200);
  assert.equal(narrowWindow.data.entries.length, 1);

  const allWindow = await jsonRequest(inventoryGet, {
    url: `http://localhost/api/inventory?storeId=${store.id}&withinDays=all`,
  });
  assert.equal(allWindow.response.status, 200);
  assert.equal(allWindow.data.entries.length, 2);
});

test("admin clients and user assignment APIs", async () => {
  const adminLogin = await loginUser("admin", "admin123");
  assert.equal(adminLogin.ok, true);
  if (!adminLogin.ok) return;
  await setMockSession(adminLogin.token);

  const createClient = await jsonRequest(clientsPost, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Acme",
      monthlyFeePerStore: 15,
    }),
  });
  assert.equal(createClient.response.status, 201);

  await registerPost(
    new Request("http://localhost/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "staff", password: "password123", accountType: "home" }),
    }),
  );
  await setMockSession(adminLogin.token);

  const registeredUser = await db.user.findUnique({ where: { username: "staff" } });
  assert.ok(registeredUser);

  const client = createClient.data.client;
  const store = await db.store.create({
    data: { clientId: client.id, name: "Downtown" },
  });

  const assign = await jsonRequest(usersPatch, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userId: registeredUser!.id,
      clientId: client.id,
      storeIds: [store.id],
      active: true,
    }),
  });
  assert.equal(assign.response.status, 200);

  const list = await jsonRequest(clientsGet, {
    url: "http://localhost/api/admin/clients",
  });
  assert.equal(list.response.status, 200);
  assert.ok(list.data.clients.some((client: { name: string }) => client.name === "Acme"));
});

test("PATCH /api/admin/users allows multiple owners on one client", async () => {
  const adminLogin = await loginUser("admin", "admin123");
  assert.equal(adminLogin.ok, true);
  if (!adminLogin.ok) return;
  await setMockSession(adminLogin.token);

  const client = await seedClientWithStore(db);
  const store = client.stores[0];
  const ownerOne = await seedUserWithAccess(db, client.id, store.id, "owner_one");
  const ownerTwo = await seedUserWithAccess(db, client.id, store.id, "owner_two");

  const makeOwnerOne = await jsonRequest(usersPatch, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userId: ownerOne.id,
      clientId: client.id,
      storeIds: [store.id],
      active: true,
      clientRole: "OWNER",
    }),
  });
  assert.equal(makeOwnerOne.response.status, 200);

  const makeOwnerTwo = await jsonRequest(usersPatch, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userId: ownerTwo.id,
      clientId: client.id,
      storeIds: [store.id],
      active: true,
      clientRole: "OWNER",
    }),
  });
  assert.equal(makeOwnerTwo.response.status, 200);

  const owners = await db.user.findMany({
    where: { clientId: client.id, clientRole: "OWNER", active: true },
    select: { username: true },
    orderBy: { username: "asc" },
  });
  assert.deepEqual(
    owners.map((user) => user.username),
    ["owner_one", "owner_two"],
  );
});

test("team API lets an owner promote another user to owner", async () => {
  const client = await seedClientWithStore(db);
  const store = client.stores[0];
  const owner = await seedUserWithAccess(db, client.id, store.id, "team_owner");
  await db.user.update({ where: { id: owner.id }, data: { clientRole: "OWNER" } });
  const member = await seedUserWithAccess(db, client.id, store.id, "team_member");

  const ownerLogin = await loginUser("team_owner", "password123");
  assert.equal(ownerLogin.ok, true);
  if (!ownerLogin.ok) return;
  await setMockSession(ownerLogin.token);

  const promote = await jsonRequest(teamPatch, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId: member.id, clientRole: "OWNER" }),
  });
  assert.equal(promote.response.status, 200);

  const owners = await db.user.count({
    where: { clientId: client.id, clientRole: "OWNER", active: true },
  });
  assert.equal(owners, 2);
});

test("home user flag on client is inherited by assigned users", async () => {
  const adminLogin = await loginUser("admin", "admin123");
  assert.equal(adminLogin.ok, true);
  if (!adminLogin.ok) return;
  await setMockSession(adminLogin.token);

  const createClient = await jsonRequest(clientsPost, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Home Client",
      monthlyFeePerStore: 10,
      homeUser: true,
    }),
  });
  assert.equal(createClient.response.status, 201);
  assert.equal(createClient.data.client.homeUser, true);

  const client = createClient.data.client;
  const store = await db.store.create({
    data: { clientId: client.id, name: "Home Store" },
  });
  const user = await seedUserWithAccess(db, client.id, store.id, "home_worker");

  const disabled = await jsonRequest(clientsPatch, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: client.id, homeUser: false }),
  });
  assert.equal(disabled.response.status, 200);
  assert.equal(disabled.data.client.homeUser, false);

  const enabled = await jsonRequest(clientsPatch, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: client.id, homeUser: true }),
  });
  assert.equal(enabled.response.status, 200);
  assert.equal(enabled.data.client.homeUser, true);

  const workerLogin = await loginUser(user.username, "password123");
  assert.equal(workerLogin.ok, true);
  if (!workerLogin.ok) return;
  await setMockSession(workerLogin.token);

  const me = await jsonRequest(meGet, {
    url: "http://localhost/api/auth/me",
  });
  assert.equal(me.response.status, 200);
  assert.equal(me.data.user.homeUser, true);
});

test("buy list API is isolated from inventory and gated by homeUser", async () => {
  const regularClient = await seedClientWithStore(db);
  const regularStore = regularClient.stores[0];
  const regularUser = await seedUserWithAccess(
    db,
    regularClient.id,
    regularStore.id,
    "regular_worker",
  );
  const regularLogin = await loginUser(regularUser.username, "password123");
  assert.equal(regularLogin.ok, true);
  if (!regularLogin.ok) return;
  await setMockSession(regularLogin.token);

  const denied = await jsonRequest(buyListGet, {
    url: `http://localhost/api/buy-list?storeId=${regularStore.id}`,
  });
  assert.equal(denied.response.status, 403);

  const homeClient = await db.client.create({
    data: {
      name: "Home Shop",
      monthlyFeePerStore: 10,
      homeUser: true,
      stores: { create: { name: "Home Store" } },
    },
    include: { stores: true },
  });
  const homeStore = homeClient.stores[0];
  const homeUser = await seedUserWithAccess(
    db,
    homeClient.id,
    homeStore.id,
    "home_buyer",
  );
  const product = await db.product.create({
    data: { barcode: "5901234123457", name: "Bread" },
  });

  const homeLogin = await loginUser(homeUser.username, "password123");
  assert.equal(homeLogin.ok, true);
  if (!homeLogin.ok) return;
  await setMockSession(homeLogin.token);

  const created = await jsonRequest(buyListPost, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      storeId: homeStore.id,
      barcode: product.barcode,
      productId: product.id,
      quantity: 2,
    }),
  });
  assert.equal(created.response.status, 201);
  assert.equal(created.data.entry.quantity, 2);

  const merged = await jsonRequest(buyListPost, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      storeId: homeStore.id,
      barcode: product.barcode,
      productId: product.id,
      quantity: 3,
    }),
  });
  assert.equal(merged.response.status, 200);
  assert.equal(merged.data.merged, true);
  assert.equal(merged.data.entry.quantity, 5);

  const list = await jsonRequest(buyListGet, {
    url: `http://localhost/api/buy-list?storeId=${homeStore.id}`,
  });
  assert.equal(list.response.status, 200);
  assert.equal(list.data.entries.length, 1);
  assert.equal(list.data.entries[0].quantity, 5);

  const entryId = list.data.entries[0].id as string;

  const updated = await jsonRequest(buyListPatch, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      entryId,
      storeId: homeStore.id,
      quantity: 4,
    }),
  });
  assert.equal(updated.response.status, 200);
  assert.equal(updated.data.entry.quantity, 4);

  const removed = await jsonRequest(buyListPatch, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ entryId, storeId: homeStore.id }),
  });
  assert.equal(removed.response.status, 200);
  assert.equal(removed.data.ok, true);

  const empty = await jsonRequest(buyListGet, {
    url: `http://localhost/api/buy-list?storeId=${homeStore.id}`,
  });
  assert.equal(empty.data.entries.length, 0);

  const inventory = await jsonRequest(inventoryPost, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      storeId: homeStore.id,
      barcode: product.barcode,
      productId: product.id,
      quantity: 1,
      expiryDate: new Date("2026-12-31T00:00:00.000Z").toISOString(),
    }),
  });
  assert.equal(inventory.response.status, 201);

  const inventoryList = await jsonRequest(inventoryGet, {
    url: `http://localhost/api/inventory?storeId=${homeStore.id}&withinDays=all`,
  });
  assert.equal(inventoryList.data.entries.length, 1);
  assert.equal(empty.data.entries.length, 0);
});

test("GET /api/admin/users supports search and pagination", async () => {
  const adminLogin = await loginUser("admin", "admin123");
  assert.equal(adminLogin.ok, true);
  if (!adminLogin.ok) return;
  await setMockSession(adminLogin.token);

  const clientA = await db.client.create({
    data: { name: "Alpha Retail", monthlyFeePerStore: 10 },
  });
  const clientB = await db.client.create({
    data: { name: "Beta Shops", monthlyFeePerStore: 10 },
  });
  const storeA = await db.store.create({
    data: { clientId: clientA.id, name: "Alpha Downtown" },
  });

  await db.user.create({
    data: {
      username: "alpha_user",
      passwordHash: "hash",
      clientId: clientA.id,
      storeLinks: { create: { storeId: storeA.id } },
    },
  });
  await db.user.create({
    data: {
      username: "beta_user",
      passwordHash: "hash",
      clientId: clientB.id,
    },
  });
  await db.user.create({
    data: {
      username: "gamma_user",
      passwordHash: "hash",
    },
  });

  const page1 = await jsonRequest(usersGet, {
    url: "http://localhost/api/admin/users?page=1&pageSize=2",
  });
  assert.equal(page1.response.status, 200);
  assert.equal(page1.data.users.length, 2);
  assert.equal(page1.data.total, 4);
  assert.equal(page1.data.totalPages, 2);

  const page2 = await jsonRequest(usersGet, {
    url: "http://localhost/api/admin/users?page=2&pageSize=2",
  });
  assert.equal(page2.data.users.length, 2);

  const byUsername = await jsonRequest(usersGet, {
    url: "http://localhost/api/admin/users?q=alpha_user",
  });
  assert.equal(byUsername.data.users.length, 1);
  assert.equal(byUsername.data.users[0].username, "alpha_user");

  const byClient = await jsonRequest(usersGet, {
    url: "http://localhost/api/admin/users?q=Beta",
  });
  assert.equal(byClient.data.users.length, 1);
  assert.equal(byClient.data.users[0].username, "beta_user");

  const byStore = await jsonRequest(usersGet, {
    url: "http://localhost/api/admin/users?q=Downtown",
  });
  assert.equal(byStore.data.users.length, 1);
  assert.equal(byStore.data.users[0].username, "alpha_user");
});

test("PATCH /api/admin/users renames username and syncs denormalized copies", async () => {
  const adminLogin = await loginUser("admin", "admin123");
  assert.equal(adminLogin.ok, true);
  if (!adminLogin.ok) return;
  await setMockSession(adminLogin.token);

  const client = await seedClientWithStore(db);
  const store = client.stores[0];
  assert.ok(store);

  const { hashPassword } = await import("../src/lib/password");
  const created = await db.user.create({
    data: {
      username: "rename_me",
      passwordHash: await hashPassword("password123"),
      role: "USER",
      clientId: client.id,
      clientRole: "MEMBER",
      storeLinks: { create: [{ storeId: store.id }] },
    },
  });

  await db.auditLog.create({
    data: {
      userId: created.id,
      username: "rename_me",
      event: "login",
      details: "test",
    },
  });
  await db.documentOcrScan.create({
    data: {
      userId: created.id,
      username: "rename_me",
      storeId: store.id,
    },
  });

  const renamed = await jsonRequest(usersPatch, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userId: created.id,
      clientId: client.id,
      username: "renamed_user",
    }),
  });
  assert.equal(renamed.response.status, 200, JSON.stringify(renamed.data));

  const user = await db.user.findUnique({ where: { id: created.id } });
  assert.equal(user?.username, "renamed_user");
  assert.equal(await db.user.findUnique({ where: { username: "rename_me" } }), null);

  const auditRows = await db.auditLog.findMany({ where: { userId: created.id } });
  assert.ok(auditRows.length >= 1);
  assert.ok(auditRows.every((row) => row.username === "renamed_user"));

  const ocrRows = await db.documentOcrScan.findMany({ where: { userId: created.id } });
  assert.equal(ocrRows.length, 1);
  assert.equal(ocrRows[0]?.username, "renamed_user");

  const taken = await jsonRequest(usersPatch, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userId: created.id,
      clientId: client.id,
      username: "admin",
    }),
  });
  assert.equal(taken.response.status, 400);

  const loginOld = await loginUser("rename_me", "password123");
  assert.equal(loginOld.ok, false);
  const loginNew = await loginUser("renamed_user", "password123");
  assert.equal(loginNew.ok, true);
});

test("PATCH /api/team/users renames member and syncs denormalized username copies", async () => {
  const client = await seedClientWithStore(db);
  const store = client.stores[0]!;
  const owner = await seedUserWithAccess(db, client.id, store.id, "rename_owner");
  await db.user.update({
    where: { id: owner.id },
    data: { clientRole: "OWNER" },
  });
  const member = await seedUserWithAccess(db, client.id, store.id, "old_member");
  await db.user.update({
    where: { id: member.id },
    data: { clientRole: "MEMBER" },
  });

  await db.auditLog.create({
    data: {
      userId: member.id,
      username: "old_member",
      event: "login",
      details: "team rename test",
    },
  });
  await db.documentOcrScan.create({
    data: {
      userId: member.id,
      username: "old_member",
      storeId: store.id,
    },
  });

  const ownerLogin = await loginUser("rename_owner", "password123");
  assert.equal(ownerLogin.ok, true);
  if (!ownerLogin.ok) return;
  await setMockSession(ownerLogin.token);

  const renamed = await jsonRequest(teamPatch, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userId: member.id,
      username: "new_member",
    }),
  });
  assert.equal(renamed.response.status, 200, JSON.stringify(renamed.data));
  assert.equal(renamed.data.user.username, "new_member");

  const updated = await db.user.findUnique({ where: { id: member.id } });
  assert.equal(updated?.username, "new_member");
  const audits = await db.auditLog.findMany({ where: { userId: member.id } });
  assert.ok(audits.every((row) => row.username === "new_member"));
  const scans = await db.documentOcrScan.findMany({ where: { userId: member.id } });
  assert.ok(scans.every((row) => row.username === "new_member"));

  const invalid = await jsonRequest(teamPatch, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userId: member.id,
      username: "Bad Name!",
    }),
  });
  assert.equal(invalid.response.status, 400);
});

test("after username rename, /api/auth/me and requireSession use the new name with old JWT", async () => {
  const client = await seedClientWithStore(db);
  const store = client.stores[0]!;
  const user = await seedUserWithAccess(db, client.id, store.id, "stale_jwt");
  await db.user.update({
    where: { id: user.id },
    data: { clientRole: "OWNER" },
  });

  const login = await loginUser("stale_jwt", "password123");
  assert.equal(login.ok, true);
  if (!login.ok) return;
  await setMockSession(login.token);

  // JWT still says stale_jwt; DB rename happens without re-login.
  await db.user.update({
    where: { id: user.id },
    data: { username: "fresh_jwt" },
  });

  const me = await jsonRequest(meGet, {
    url: "http://localhost/api/auth/me",
  });
  assert.equal(me.response.status, 200);
  assert.equal(me.data.user.username, "fresh_jwt");

  const { requireSession } = await import("../src/lib/auth");
  const session = await requireSession();
  assert.equal(session.username, "fresh_jwt");
  assert.equal(session.userId, user.id);
});

test("PATCH /api/admin/users deactivates user without client assignment", async () => {
  const adminLogin = await loginUser("admin", "admin123");
  assert.equal(adminLogin.ok, true);
  if (!adminLogin.ok) return;
  await setMockSession(adminLogin.token);

  const { hashPassword } = await import("../src/lib/password");
  await db.user.create({
    data: {
      username: "inactive_user",
      passwordHash: await hashPassword("password123"),
      role: "USER",
    },
  });

  const user = await db.user.findUnique({ where: { username: "inactive_user" } });
  assert.ok(user);

  const deactivate = await jsonRequest(usersPatch, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userId: user!.id,
      clientId: null,
      storeIds: [],
      active: false,
    }),
  });
  assert.equal(deactivate.response.status, 200);

  const updated = await db.user.findUnique({ where: { id: user!.id } });
  assert.equal(updated?.active, false);
});

test("DELETE /api/admin/users removes regular users", async () => {
  const adminLogin = await loginUser("admin", "admin123");
  assert.equal(adminLogin.ok, true);
  if (!adminLogin.ok) return;
  await setMockSession(adminLogin.token);

  const created = await db.user.create({
    data: {
      username: "delete_me",
      passwordHash: "hash",
    },
  });

  const removed = await jsonRequest(usersDelete, {
    method: "DELETE",
    url: `http://localhost/api/admin/users?userId=${created.id}`,
  });
  assert.equal(removed.response.status, 200);

  const gone = await db.user.findUnique({ where: { id: created.id } });
  assert.equal(gone, null);

  const adminUser = await db.user.findUnique({ where: { username: "admin" } });
  assert.ok(adminUser);

  const blockAdmin = await jsonRequest(usersDelete, {
    method: "DELETE",
    url: `http://localhost/api/admin/users?userId=${adminUser!.id}`,
  });
  assert.equal(blockAdmin.response.status, 400);
});

test("payments calendar and mark paid APIs", async () => {
  const adminLogin = await loginUser("admin", "admin123");
  assert.equal(adminLogin.ok, true);
  if (!adminLogin.ok) return;
  await setMockSession(adminLogin.token);

  const client = await seedClientWithStore(db);
  const now = new Date();

  const calendar = await jsonRequest(calendarGet, {
    url: `http://localhost/api/admin/payments/calendar?year=${now.getFullYear()}&month=${now.getMonth() + 1}&calendar=1`,
  });
  assert.equal(calendar.response.status, 200);
  assert.equal(calendar.data.rows.length, 1);
  assert.equal(calendar.data.rows[0].paid, false);

  const markPaid = await jsonRequest(paymentsPost, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      clientId: client.id,
      year: now.getFullYear(),
      month: now.getMonth() + 1,
      discount: 0,
    }),
  });
  assert.equal(markPaid.response.status, 201);
  assert.equal(markPaid.data.payment.amountPaid, 20);
});

test("payment enforcement blocks unpaid retail login when overdue", async () => {
  const client = await seedClientWithStore(db);
  const user = await seedUserWithAccess(db, client.id, client.stores[0].id);

  await db.client.update({
    where: { id: client.id },
    data: { paymentsRequired: false, paymentsRequiredSince: null },
  });
  const openLogin = await loginUser(user.username, "password123");
  assert.equal(openLogin.ok, true);

  // Turn payments on this month — current month may stay unpaid (grace).
  const now = new Date();
  const since = new Date(now.getFullYear(), now.getMonth(), 1);
  await db.client.update({
    where: { id: client.id },
    data: {
      paymentsRequired: true,
      monthlyFeePerStore: 20,
      paymentsRequiredSince: since,
    },
  });
  const graceLogin = await loginUser(user.username, "password123");
  assert.equal(graceLogin.ok, true);

  // Simulate next month with previous month still unpaid → locked.
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  await db.client.update({
    where: { id: client.id },
    data: { paymentsRequiredSince: prev },
  });
  const blocked = await loginUser(user.username, "password123");
  assert.equal(blocked.ok, false);
  if (!blocked.ok) {
    assert.equal(blocked.code, "PAYMENT_REQUIRED");
  }

  const adminLogin = await loginUser("admin", "admin123");
  assert.equal(adminLogin.ok, true);
  if (!adminLogin.ok) return;
  await setMockSession(adminLogin.token);

  const markPaid = await jsonRequest(paymentsPost, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      clientId: client.id,
      year: prev.getFullYear(),
      month: prev.getMonth() + 1,
      discount: 0,
    }),
  });
  assert.equal(markPaid.response.status, 201);

  const allowed = await loginUser(user.username, "password123");
  assert.equal(allowed.ok, true);

  await db.client.update({
    where: { id: client.id },
    data: { paymentsRequired: true, monthlyFeePerStore: 0 },
  });
  await db.store.updateMany({
    where: { clientId: client.id },
    data: { monthlyFee: 0 },
  });
  const freeLogin = await loginUser(user.username, "password123");
  assert.equal(freeLogin.ok, true);
});

test("cron purge endpoint requires secret", async () => {
  const forbidden = await jsonRequest(cronPost, { method: "POST" });
  assert.equal(forbidden.response.status, 403);

  const allowed = await jsonRequest(cronPost, {
    method: "POST",
    headers: { "x-cron-secret": "test-cron-secret" },
  });
  assert.equal(allowed.response.status, 200);
  assert.equal(typeof allowed.data.purged, "number");
});

test.after(async () => {
  await db.$disconnect();
});

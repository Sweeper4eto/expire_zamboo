import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import type { PrismaClient } from "@/generated/prisma/client";
import {
  migrateTestDb,
  resetTestDb,
  setupTestEnv,
} from "./helpers/db";

setupTestEnv();
migrateTestDb();

let db: PrismaClient;
let invalidateZambooCatalogCache: typeof import("../src/lib/zamboo/catalog").invalidateZambooCatalogCache;
let matchZambooRows: typeof import("../src/lib/zamboo/match").matchZambooRows;
let syncZambooCatalogIfDue: typeof import("../src/lib/zamboo/sync").syncZambooCatalogIfDue;

function mockFetch(body: unknown): typeof fetch {
  return (async () =>
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })) as typeof fetch;
}

describe("zamboo catalog sync", () => {
  before(async () => {
    ({ db } = await import("../src/lib/db"));
    ({ invalidateZambooCatalogCache } = await import("../src/lib/zamboo/catalog"));
    ({ matchZambooRows } = await import("../src/lib/zamboo/match"));
    ({ syncZambooCatalogIfDue } = await import("../src/lib/zamboo/sync"));
    process.env.ZAMBOO_API_KEY = "test-zamboo-key";
  });

  after(async () => {
    await db.$disconnect();
  });

  it("stores the remote catalog locally and matches against the cache", async () => {
    await resetTestDb(db);
    invalidateZambooCatalogCache();

    const first = await syncZambooCatalogIfDue({
      force: true,
      fetchImpl: mockFetch([
        {
          gId: "c-500",
          name: "Кока Кола 500мл бут.",
          altName: "",
          code: 9928,
          basePrice: 2.2,
          itemType: 1,
          uom: { name: "бр" },
          category: { name: "НАПИТКИ" },
          type: { name: "ХРАНИТЕЛНИ" },
        },
        {
          gId: "hipp",
          name: "ХИПП 1 БИО КОМБИОТИК",
          altName: "9062300134268",
          code: 2001187,
        },
      ]),
    });
    assert.equal(first.skipped, false);
    assert.equal(first.itemCount, 2);
    assert.equal(await db.zambooItem.count(), 2);

    const second = await syncZambooCatalogIfDue({
      fetchImpl: mockFetch([]),
    });
    assert.equal(second.skipped, true);
    assert.equal(second.reason, "fresh");
    assert.equal(await db.zambooItem.count(), 2);

    invalidateZambooCatalogCache();
    const [hit] = await matchZambooRows([
      { name: "Coca-Cola 500ml bottle", barcode: null, articul: null },
    ]);
    assert.equal(hit?.gId, "c-500");
    assert.equal(hit?.code, "9928");
  });
});

import test from "node:test";
import assert from "node:assert/strict";
import {
  aslStoreSchema,
  isMinimartVisitStatus,
  mapAslStoreToUpsert,
  MINIMART_STATUS_COLORS,
  MINIMART_STATUSES,
} from "../src/lib/minimart-locator";

test("mapAslStoreToUpsert maps ASL payload fields", () => {
  const parsed = aslStoreSchema.parse({
    id: 65,
    title: "Minimart",
    street: "ул. Тест 1",
    city: "София",
    postal_code: "1000",
    country: "Bulgaria",
    lat: "42.7",
    lng: "23.3",
    phone: "",
    website: "https://mini-mart.bg/",
    open_hours: "{}",
    slug: "minimart-sofia",
  });
  const row = mapAslStoreToUpsert(parsed);
  assert.ok(row);
  assert.equal(row.externalId, "65");
  assert.equal(row.city, "София");
  assert.equal(row.lat, 42.7);
  assert.equal(row.lng, 23.3);
});

test("mapAslStoreToUpsert rejects invalid coordinates", () => {
  const parsed = aslStoreSchema.parse({
    id: "1",
    lat: "x",
    lng: "y",
  });
  assert.equal(mapAslStoreToUpsert(parsed), null);
});

test("minimart status colors cover all statuses", () => {
  for (const status of MINIMART_STATUSES) {
    assert.equal(typeof MINIMART_STATUS_COLORS[status], "string");
    assert.ok(MINIMART_STATUS_COLORS[status].startsWith("#"));
  }
  assert.equal(isMinimartVisitStatus("ACCEPTED"), true);
  assert.equal(isMinimartVisitStatus("marked"), false);
});

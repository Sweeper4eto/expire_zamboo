import test from "node:test";
import assert from "node:assert/strict";
import {
  buildExpiryDigestPayload,
  daysUntilExpiry,
  shouldSendDigest,
} from "../src/lib/push-expiry";

test("daysUntilExpiry rounds up partial days", () => {
  const now = new Date("2026-06-01T12:00:00Z");
  const expiry = new Date("2026-06-03T01:00:00Z");
  assert.equal(daysUntilExpiry(expiry, now), 2);
});

test("buildExpiryDigestPayload returns null for empty list", () => {
  assert.equal(buildExpiryDigestPayload([]), null);
});

test("buildExpiryDigestPayload highlights urgent items in English", () => {
  const payload = buildExpiryDigestPayload(
    [
      {
        productName: "Milk",
        storeName: "Central",
        storeId: "store-1",
        quantity: 3,
        daysUntilExpiry: 3,
      },
    ],
    "en",
    { tier: "urgent", withinDays: 3 },
  );

  assert.ok(payload);
  assert.match(payload.title, /^Central:/);
  assert.match(payload.title, /Milk/);
  assert.match(payload.body, /3/);
  assert.equal(payload.url, "/app/expiry?storeId=store-1");
});

test("buildExpiryDigestPayload highlights early warning in English", () => {
  const payload = buildExpiryDigestPayload(
    [
      {
        productName: "Yogurt",
        storeName: "Central",
        storeId: "store-1",
        quantity: 2,
        daysUntilExpiry: 12,
      },
    ],
    "en",
    { tier: "early", withinDays: 14 },
  );

  assert.ok(payload);
  assert.match(payload.title, /14 days/);
});

test("buildExpiryDigestPayload highlights critical items in Bulgarian", () => {
  const payload = buildExpiryDigestPayload(
    [
      {
        productName: "Мляко",
        storeName: "Централен",
        storeId: "store-1",
        quantity: 3,
        daysUntilExpiry: 3,
      },
    ],
    "bg",
    { tier: "urgent", withinDays: 3 },
  );

  assert.ok(payload);
  assert.match(payload.title, /^Централен:/);
  assert.match(payload.title, /Мляко/);
});

test("buildExpiryDigestPayload links to store expiry for a single-store list", () => {
  const payload = buildExpiryDigestPayload(
    [
      {
        productName: "Milk",
        storeName: "Central",
        storeId: "store-1",
        quantity: 1,
        daysUntilExpiry: 3,
      },
      {
        productName: "Bread",
        storeName: "Central",
        storeId: "store-1",
        quantity: 2,
        daysUntilExpiry: 2,
      },
    ],
    "en",
    { tier: "urgent", withinDays: 3 },
  );

  assert.ok(payload);
  assert.equal(payload.url, "/app/expiry?storeId=store-1");
  assert.match(payload.title, /Central/);
});

test("buildExpiryDigestPayload falls back to app home if stores are mixed", () => {
  const payload = buildExpiryDigestPayload(
    [
      {
        productName: "Milk",
        storeName: "Central",
        storeId: "store-1",
        quantity: 1,
        daysUntilExpiry: 3,
      },
      {
        productName: "Bread",
        storeName: "North",
        storeId: "store-2",
        quantity: 2,
        daysUntilExpiry: 2,
      },
    ],
    "en",
    { tier: "urgent", withinDays: 3 },
  );

  assert.ok(payload);
  assert.equal(payload.url, "/app");
});

test("shouldSendDigest throttles repeat sends within 20 hours", () => {
  const now = new Date("2026-06-02T12:00:00Z");
  const recent = new Date("2026-06-02T08:00:00Z");
  const old = new Date("2026-06-01T08:00:00Z");

  assert.equal(shouldSendDigest(null, now), true);
  assert.equal(shouldSendDigest(recent, now), false);
  assert.equal(shouldSendDigest(old, now), true);
});

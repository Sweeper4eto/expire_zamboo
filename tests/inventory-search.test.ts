import test from "node:test";
import assert from "node:assert/strict";
import {
  filterInventoryEntriesBySearch,
  matchesInventorySearch,
  parseInventoryDateQuery,
} from "../src/lib/inventory-search";

const yogurt = {
  barcode: "5901234567890",
  product: { name: "Vitamin C compounds" },
};

const milkBg = {
  barcode: "222",
  product: { name: "Мляко 3.2%" },
};

test("matchesInventorySearch is case-insensitive on product name", () => {
  assert.equal(matchesInventorySearch(yogurt, "vitamin"), true);
  assert.equal(matchesInventorySearch(yogurt, "VITAMIN"), true);
  assert.equal(matchesInventorySearch(yogurt, "comp"), true);
});

test("matchesInventorySearch matches Cyrillic names", () => {
  assert.equal(matchesInventorySearch(milkBg, "мляко"), true);
  assert.equal(matchesInventorySearch(milkBg, "МЛЯКО"), true);
});

test("matchesInventorySearch matches barcode fragments", () => {
  assert.equal(matchesInventorySearch(yogurt, "590123"), true);
  assert.equal(matchesInventorySearch(yogurt, "999"), false);
});

test("matchesInventorySearch supports multi-word queries", () => {
  assert.equal(matchesInventorySearch(yogurt, "vitamin c"), true);
  assert.equal(matchesInventorySearch(yogurt, "vitamin x"), false);
});

test("matchesInventorySearch matches expiry and added dates", () => {
  const entry = {
    barcode: "111",
    product: { name: "Milk" },
    expiryDate: "2026-09-25T00:00:00.000Z",
    enteredAt: "2026-08-10T14:30:00.000Z",
  };

  assert.equal(matchesInventorySearch(entry, "25.09.2026"), true);
  assert.equal(matchesInventorySearch(entry, "25/09/2026"), true);
  assert.equal(matchesInventorySearch(entry, "25-09-2026"), true);
  assert.equal(matchesInventorySearch(entry, "2026-09-25"), true);
  assert.equal(matchesInventorySearch(entry, "25.09"), true);
  assert.equal(matchesInventorySearch(entry, "25/09"), true);
  assert.equal(matchesInventorySearch(entry, "25"), true);
  assert.equal(matchesInventorySearch(entry, "09"), true);
  assert.equal(matchesInventorySearch(entry, "09.2026"), true);
  assert.equal(matchesInventorySearch(entry, "09/2026"), true);
  assert.equal(matchesInventorySearch(entry, "2026"), true);
  assert.equal(matchesInventorySearch(entry, "10.08.2026"), true);
  assert.equal(matchesInventorySearch(entry, "10/08"), true);
  assert.equal(matchesInventorySearch(entry, "01.01.2026"), false);
  assert.equal(matchesInventorySearch(entry, "01"), false);
  assert.equal(matchesInventorySearch(entry, "milk"), true);
});

test("parseInventoryDateQuery accepts day-first, slashes, and partials", () => {
  assert.deepEqual(parseInventoryDateQuery("25.09.2026"), {
    d: 25,
    m: 9,
    y: 2026,
  });
  assert.deepEqual(parseInventoryDateQuery("25/09/2026"), {
    d: 25,
    m: 9,
    y: 2026,
  });
  assert.deepEqual(parseInventoryDateQuery("2026-09-25"), {
    y: 2026,
    m: 9,
    d: 25,
  });
  assert.deepEqual(parseInventoryDateQuery("25.09"), { d: 25, m: 9 });
  assert.deepEqual(parseInventoryDateQuery("25/09"), { d: 25, m: 9 });
  assert.deepEqual(parseInventoryDateQuery("25"), { d: 25 });
  assert.equal(parseInventoryDateQuery("milk"), null);
});

import test from "node:test";
import assert from "node:assert/strict";
import {
  expiryDateDayBounds,
  normalizeExpiryDate,
} from "../src/lib/inventory";

test("normalizeExpiryDate stores UTC midnight", () => {
  const date = new Date("2026-07-15T14:30:00.000Z");
  const normalized = normalizeExpiryDate(date);
  assert.equal(normalized.toISOString(), "2026-07-15T00:00:00.000Z");
});

test("expiryDateDayBounds covers the full calendar day", () => {
  const { start, end } = expiryDateDayBounds(new Date("2026-07-15T23:59:59.000Z"));
  assert.equal(start.toISOString(), "2026-07-15T00:00:00.000Z");
  assert.equal(end.toISOString(), "2026-07-16T00:00:00.000Z");
});

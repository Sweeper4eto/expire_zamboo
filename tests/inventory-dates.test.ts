import test from "node:test";
import assert from "node:assert/strict";
import {
  expiryIsoToYmd,
  expiryYmdToIso,
  normalizeExpiryDate,
} from "../src/lib/inventory";

test("expiryIsoToYmd and expiryYmdToIso round-trip UTC days", () => {
  const iso = normalizeExpiryDate(new Date("2026-08-15T15:30:00Z")).toISOString();
  assert.equal(expiryIsoToYmd(iso), "2026-08-15");
  assert.equal(expiryYmdToIso("2026-08-15"), "2026-08-15T00:00:00.000Z");
});

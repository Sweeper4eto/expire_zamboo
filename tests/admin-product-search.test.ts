import test from "node:test";
import assert from "node:assert/strict";

function isBarcodeLike(q: string): boolean {
  const compact = q.replace(/\s/g, "");
  const digits = compact.replace(/\D/g, "");
  return digits.length >= 4 && digits.length === compact.length;
}

test("isBarcodeLike detects digit queries", () => {
  assert.equal(isBarcodeLike("7311570012295"), true);
  assert.equal(isBarcodeLike("7311"), true);
  assert.equal(isBarcodeLike("731"), false);
  assert.equal(isBarcodeLike("Chio"), false);
  assert.equal(isBarcodeLike("380 006"), true);
  assert.equal(isBarcodeLike("deva 123"), false);
});

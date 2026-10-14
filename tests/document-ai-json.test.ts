import test from "node:test";
import assert from "node:assert/strict";
import { repairTruncatedItemsJson } from "../src/lib/document-ai";

test("repairTruncatedItemsJson closes cut-off items array", () => {
  const raw = `{"items":[{"name":"A","articul":"1","quantity":2},{"name":"B","articul":"2","quantity":`;
  const repaired = repairTruncatedItemsJson(raw);
  assert.ok(repaired);
  const parsed = JSON.parse(repaired!);
  assert.equal(parsed.items.length, 1);
  assert.equal(parsed.items[0].name, "A");
});

test("repairTruncatedItemsJson keeps complete objects only", () => {
  const raw = `{"items":[{"name":"A","quantity":1},{"name":"B","quantity":2},{"name":"C"`;
  const repaired = repairTruncatedItemsJson(raw);
  assert.ok(repaired);
  const parsed = JSON.parse(repaired!);
  assert.equal(parsed.items.length, 2);
});

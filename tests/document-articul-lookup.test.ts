import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { articulLookupKeys } from "../src/lib/document-match";

describe("articulLookupKeys", () => {
  it("keeps a normal SKU as a single key", () => {
    assert.deepEqual(articulLookupKeys("55102"), ["55102"]);
    assert.deepEqual(articulLookupKeys("900001197"), ["900001197"]);
  });

  it("adds a leading-9 twin when OCR drops 9 before 0000…", () => {
    assert.deepEqual(articulLookupKeys("00001197"), [
      "00001197",
      "900001197",
    ]);
    assert.deepEqual(articulLookupKeys("00001219"), [
      "00001219",
      "900001219",
    ]);
  });

  it("does not invent a twin for short zero prefixes", () => {
    assert.deepEqual(articulLookupKeys("0001197"), ["0001197"]);
    assert.deepEqual(articulLookupKeys("001197"), ["001197"]);
  });

  it("trims whitespace", () => {
    assert.deepEqual(articulLookupKeys("  00001197  "), [
      "00001197",
      "900001197",
    ]);
  });
});

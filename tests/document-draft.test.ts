import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  computeRowShiftWarningKeys,
  draftHasMissingInfo,
  draftHasWarnings,
  draftItemValid,
  draftMatchesSearch,
  draftWarnings,
  type DocumentDraftItem,
} from "../src/lib/document-draft";

const base: DocumentDraftItem = {
  key: "1",
  name: "Milk",
  barcode: "",
  articul: "123",
  expiryYmd: "2026-12-01",
  quantity: "2",
  productId: null,
  productImagePath: null,
  matchSource: null,
};

describe("document-draft", () => {
  it("detects missing name or expiry", () => {
    assert.equal(draftHasMissingInfo(base), false);
    assert.equal(draftHasMissingInfo({ ...base, name: "  " }), true);
    assert.equal(draftHasMissingInfo({ ...base, expiryYmd: "" }), true);
  });

  it("validates complete rows", () => {
    assert.equal(draftItemValid(base), true);
    assert.equal(draftItemValid({ ...base, quantity: "0" }), false);
  });

  it("does not warn about catalog match; still flags bad barcodes", () => {
    const unmatched = draftWarnings({
      ...base,
      barcode: "",
      productId: null,
    });
    assert.equal(unmatched.includes("noProductMatch" as never), false);
    assert.equal(draftHasWarnings({ ...base, productId: null }), false);

    const warnings = draftWarnings({
      ...base,
      barcode: "1234567890123",
      productId: null,
    });
    assert.ok(warnings.includes("invalidBarcode"));
    assert.equal(warnings.includes("noProductMatch" as never), false);
  });

  it("filters by search needle", () => {
    assert.equal(draftMatchesSearch(base, "milk"), true);
    assert.equal(draftMatchesSearch(base, "123"), true);
    assert.equal(draftMatchesSearch(base, "bread"), false);
  });

  it("flags a single-word fragment that shares its neighbor's qty and date", () => {
    const fragment: DocumentDraftItem = {
      ...base,
      key: "a",
      name: "Праскова",
      quantity: "5",
      expiryYmd: "2026-08-12",
    };
    const full: DocumentDraftItem = {
      ...base,
      key: "b",
      name: "Бъбъл чай SIMPATICO праскова 320мл",
      quantity: "5",
      expiryYmd: "2026-08-12",
    };
    const flagged = computeRowShiftWarningKeys([fragment, full]);
    assert.equal(flagged.has("a"), true);
    assert.equal(flagged.has("b"), false);
  });

  it("does not flag two unrelated multi-word rows that happen to share a date", () => {
    const first: DocumentDraftItem = {
      ...base,
      key: "a",
      name: "Хляб typ Добруджа",
      quantity: "5",
      expiryYmd: "2026-08-12",
    };
    const second: DocumentDraftItem = {
      ...base,
      key: "b",
      name: "Мляко UHT 1L",
      quantity: "5",
      expiryYmd: "2026-08-12",
    };
    const flagged = computeRowShiftWarningKeys([first, second]);
    assert.equal(flagged.size, 0);
  });

  it("does not flag rows with missing info or different qty/date", () => {
    const missing: DocumentDraftItem = {
      ...base,
      key: "a",
      name: "Fragment",
      expiryYmd: "",
    };
    const full: DocumentDraftItem = {
      ...base,
      key: "b",
      name: "Full Product Name",
    };
    assert.equal(computeRowShiftWarningKeys([missing, full]).size, 0);

    const differentQty: DocumentDraftItem = {
      ...base,
      key: "c",
      name: "Fragment",
      quantity: "1",
      expiryYmd: "2026-08-12",
    };
    const differentFull: DocumentDraftItem = {
      ...base,
      key: "d",
      name: "Full Product Name",
      quantity: "9",
      expiryYmd: "2026-08-12",
    };
    assert.equal(
      computeRowShiftWarningKeys([differentQty, differentFull]).size,
      0,
    );
  });
});
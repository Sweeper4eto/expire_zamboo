import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  extractBarcode,
  extractPack,
  extractSizes,
  normalizeZambooName,
  sizesCompatible,
  tokensMatch,
  zambooNameTokens,
} from "../src/lib/zamboo/names";

describe("zamboo names", () => {
  it("folds Cyrillic catalog names onto Latin OCR keys", () => {
    assert.equal(normalizeZambooName("Кока Кола 500мл бут."), "koka kola 500ml but");
    assert.equal(normalizeZambooName("Coca-Cola 500ml bottle"), "coca cola 500ml bottle");
  });

  it("extracts EAN-looking alt names only", () => {
    assert.equal(extractBarcode("9062300134268"), "9062300134268");
    assert.equal(extractBarcode("Кока Кола 500мл"), null);
    assert.equal(extractBarcode("9928"), null);
  });

  it("canonicalizes pack sizes", () => {
    assert.deepEqual(extractSizes("Кока Кола 500мл бут."), ["500ml"]);
    assert.deepEqual(extractSizes("Coca-Cola 0,5л"), ["500ml"]);
    assert.deepEqual(extractSizes("Кока Кола 1.5Л"), ["1.5l"]);
    assert.deepEqual(extractSizes("Кока Кола 1.л"), ["1l"]);
  });

  it("treats missing OCR size as compatible", () => {
    assert.equal(sizesCompatible([], ["500ml"]), true);
    assert.equal(sizesCompatible(["500ml"], ["2l"]), false);
    assert.equal(sizesCompatible(["500ml"], ["500ml"]), true);
  });

  it("matches Latin/Cyrillic brand tokens with one-letter OCR drift", () => {
    assert.equal(tokensMatch("coca", "koka"), true);
    assert.equal(tokensMatch("cola", "kola"), true);
    assert.equal(tokensMatch("zero", "ziro"), true);
    assert.equal(tokensMatch("5", "6"), false);
  });

  it("drops pack stopwords from tokens", () => {
    assert.deepEqual(zambooNameTokens("Coca-Cola 500ml bottle"), [
      "coca",
      "cola",
    ]);
  });

  it("detects bottle vs can from the printed name", () => {
    assert.equal(extractPack("Кока Кола 500мл бут."), "bottle");
    assert.equal(extractPack("Кока Кола 330мл КЕН"), "can");
    assert.equal(extractPack("Кока Кола 2л"), null);
  });
});

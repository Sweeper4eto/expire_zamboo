import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  namesMatchForMerge,
  normalizeProductNameForMatch,
} from "../src/lib/product-name-match";

describe("normalizeProductNameForMatch", () => {
  it("strips punctuation/symbols but keeps letters and digits", () => {
    assert.equal(
      normalizeProductNameForMatch("Ябълка , 10 % сайдер"),
      normalizeProductNameForMatch("Ябълка 10 Сайдер"),
    );
  });

  it("collapses repeated whitespace and trims", () => {
    assert.equal(normalizeProductNameForMatch("  Milk   2L  "), "milk2l");
  });

  it("folds Latin x with Cyrillic х (multipliers)", () => {
    assert.equal(
      normalizeProductNameForMatch("10x15.5г"),
      normalizeProductNameForMatch("10х15.5г"),
    );
    assert.equal(
      normalizeProductNameForMatch("6 x 1.8Л"),
      normalizeProductNameForMatch("6 х 1.8Л"),
    );
    // Only x/х — Cyrillic а in "Мах" is not folded to Latin a.
    assert.notEqual(
      normalizeProductNameForMatch("Pepsi Max 2л"),
      normalizeProductNameForMatch("Pepsi Мах 2л"),
    );
  });

  it("canonicalizes гр / г after a digit and collapses digit spaces", () => {
    assert.equal(
      normalizeProductNameForMatch("Чипс Chio сметана и лук 125гр"),
      normalizeProductNameForMatch("Чипс Chio сметана и лук 125г"),
    );
    assert.equal(
      normalizeProductNameForMatch("CAPPY Pulpy портокал 330мл"),
      normalizeProductNameForMatch("CAPPY Pulpy портокал330мл"),
    );
  });
});

describe("namesMatchForMerge", () => {
  it("matches names that only differ by punctuation/symbols", () => {
    assert.equal(
      namesMatchForMerge("Ябълка , 10 % сайдер", "Ябълка 10 Сайдер"),
      true,
    );
    assert.equal(namesMatchForMerge("Milk!!! 2L.", "milk 2l"), true);
  });

  it("matches Latin/Cyrillic x twins", () => {
    assert.equal(
      namesMatchForMerge(
        "Кафе Nescafe Classic разтв. 3in1 10x15.5г",
        "Кафе Nescafe Classic разтв. 3in1 10х15.5г",
      ),
      true,
    );
  });

  it("does not match when a number differs", () => {
    assert.equal(
      namesMatchForMerge("Ябълка 5 % сайдер", "Ябълка 10 Сайдер"),
      false,
    );
  });

  it("does not match size variants like 82гр vs 92гр", () => {
    assert.equal(
      namesMatchForMerge(
        "7Days Doublemax Кроасан, 82гр",
        "7Days Doublemax Кроасан, 92гр",
      ),
      false,
    );
  });

  it("does not match when words differ", () => {
    assert.equal(
      namesMatchForMerge("Ябълка 10 сайдер", "Ябълка 10 сок"),
      false,
    );
  });

  it("does not match expanded abbreviation vs short form", () => {
    assert.equal(
      namesMatchForMerge(
        "Негаз.напитка CAPPY Pulpy портокал 330мл",
        "Негазирана напитка CAPPY Pulpy портокал 330мл",
      ),
      false,
    );
  });

  it("does not match two empty/symbol-only names", () => {
    assert.equal(namesMatchForMerge("...", "!!!"), false);
  });
});

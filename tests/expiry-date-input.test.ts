import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatDmyMask,
  formatYmdAsDmy,
  acceptDmyDigits,
  dmyDigitsToYmd,
  isValidPartialDmyDigits,
  parseFlexibleExpiryInput,
} from "../src/lib/expiry-date-input";
import {
  EXPIRY_PICKER_YEARS_PAST,
  expiryDateBounds,
} from "../src/lib/expiry-date-bounds";

describe("parseFlexibleExpiryInput", () => {
  it("parses DD.MM.YYYY so 06 vs 08 can be typed correctly", () => {
    assert.equal(parseFlexibleExpiryInput("08.06.2027"), "2027-06-08");
    assert.equal(parseFlexibleExpiryInput("06.08.2027"), "2027-08-06");
  });

  it("parses ISO and rejects junk", () => {
    assert.equal(parseFlexibleExpiryInput("2027-06-08"), "2027-06-08");
    assert.equal(parseFlexibleExpiryInput("n/a"), null);
    assert.equal(parseFlexibleExpiryInput("32.01.2027"), null);
  });

  it("formats ymd as dmy for the typed field", () => {
    assert.equal(formatYmdAsDmy("2027-06-08"), "08.06.2027");
  });
});

describe("dmy mask helpers", () => {
  it("keeps DD.MM.YYYY placeholders while typing", () => {
    assert.equal(formatDmyMask(""), "DD.MM.YYYY");
    assert.equal(formatDmyMask("1"), "1D.MM.YYYY");
    assert.equal(formatDmyMask("12"), "12.MM.YYYY");
    assert.equal(formatDmyMask("120"), "12.0M.YYYY");
    assert.equal(formatDmyMask("1208"), "12.08.YYYY");
    assert.equal(formatDmyMask("12082026"), "12.08.2026");
  });

  it("rejects impossible digits while typing", () => {
    assert.equal(isValidPartialDmyDigits("4"), false);
    assert.equal(isValidPartialDmyDigits("32"), false);
    assert.equal(isValidPartialDmyDigits("001"), false);
    assert.equal(isValidPartialDmyDigits("0012"), false);
    assert.equal(isValidPartialDmyDigits("3111"), false);
    assert.equal(isValidPartialDmyDigits("3102"), false);
    assert.equal(acceptDmyDigits("32122026"), "3");
    assert.equal(acceptDmyDigits("29022027"), "2902202");
    assert.equal(dmyDigitsToYmd("29022027"), null);
    assert.equal(dmyDigitsToYmd("01032027"), "2027-03-01");
  });
});

describe("expiryDateBounds", () => {
  it("blocks past days by default", () => {
    const { min } = expiryDateBounds(false);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, "0");
    const d = String(today.getDate()).padStart(2, "0");
    assert.equal(min, `${y}-${m}-${d}`);
  });

  it("allows several years in the past when editing", () => {
    const { min } = expiryDateBounds(true);
    const expected = new Date();
    expected.setHours(0, 0, 0, 0);
    expected.setFullYear(expected.getFullYear() - EXPIRY_PICKER_YEARS_PAST);
    const y = expected.getFullYear();
    const m = String(expected.getMonth() + 1).padStart(2, "0");
    const d = String(expected.getDate()).padStart(2, "0");
    assert.equal(min, `${y}-${m}-${d}`);
  });
});

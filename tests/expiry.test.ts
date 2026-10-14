import test from "node:test";
import assert from "node:assert/strict";
import {
  expiryListVisible,
  expiryUrgencyClass,
  formatLocaleDay,
  paymentAmount,
} from "../src/lib/expiry";

test("paymentAmount subtracts discount and floors at zero", () => {
  assert.equal(paymentAmount(50, 3), 47);
  assert.equal(paymentAmount(20, 25), 0);
});

test("expiryListVisible keeps all expired items and caps only the future horizon", () => {
  const now = new Date("2026-06-01");
  const inFiveWeeks = new Date("2026-07-08");
  const inThreeWeeks = new Date("2026-06-22");
  const eightMonthsAgo = new Date("2025-10-01");

  assert.equal(expiryListVisible(inFiveWeeks, now), false);
  assert.equal(expiryListVisible(inThreeWeeks, now), true);
  assert.equal(expiryListVisible(eightMonthsAgo, now), true);
  assert.equal(expiryListVisible(eightMonthsAgo, now, 14), true);
  assert.equal(expiryListVisible(inFiveWeeks, now, 14), false);
  assert.equal(expiryListVisible(eightMonthsAgo, now, "all"), true);
  assert.equal(expiryListVisible(inFiveWeeks, now, "all"), true);
});

test("expiryUrgencyClass colors by days remaining", () => {
  const now = new Date("2026-06-01");
  assert.equal(expiryUrgencyClass(new Date("2026-06-05"), now), "urgency-critical");
  assert.equal(expiryUrgencyClass(new Date("2026-06-12"), now), "urgency-warning");
  assert.equal(expiryUrgencyClass(new Date("2026-06-20"), now), "urgency-soon");
});

test("formatLocaleDay pads day and month day-first for en and bg", () => {
  assert.equal(formatLocaleDay("2027-04-15", "en-GB"), "15/04/2027");
  assert.match(formatLocaleDay("2027-04-15", "bg-BG"), /^15\.04\.2027/);
});

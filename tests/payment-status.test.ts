import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  billingStartPeriod,
  countUnpaidMonths,
  hasOverdueUnpaidMonths,
  isPaymentAccessBlocked,
  monthsInclusive,
  paymentStandingFromUnpaid,
  periodKey,
  standingSortRank,
} from "../src/lib/payment-status";

describe("payment standing", () => {
  test("monthsInclusive spans year boundary", () => {
    assert.deepEqual(
      monthsInclusive({ year: 2025, month: 11 }, { year: 2026, month: 2 }),
      [
        { year: 2025, month: 11 },
        { year: 2025, month: 12 },
        { year: 2026, month: 1 },
        { year: 2026, month: 2 },
      ],
    );
  });

  test("countUnpaidMonths ignores paid months", () => {
    const unpaid = countUnpaidMonths({
      billingStart: { year: 2026, month: 1 },
      through: { year: 2026, month: 3 },
      paidKeys: new Set([periodKey(2026, 1), periodKey(2026, 3)]),
    });
    assert.equal(unpaid, 1);
  });

  test("standing colors map unpaid counts", () => {
    assert.equal(
      paymentStandingFromUnpaid(0, {
        homeUser: false,
        paymentsRequired: true,
        expectedAmount: 40,
      }),
      "current",
    );
    assert.equal(
      paymentStandingFromUnpaid(1, {
        homeUser: false,
        paymentsRequired: true,
        expectedAmount: 40,
      }),
      "behind1",
    );
    assert.equal(
      paymentStandingFromUnpaid(2, {
        homeUser: false,
        paymentsRequired: true,
        expectedAmount: 40,
      }),
      "behind2plus",
    );
    assert.equal(
      paymentStandingFromUnpaid(5, {
        homeUser: true,
        paymentsRequired: true,
        expectedAmount: 40,
      }),
      "exempt",
    );
    assert.equal(
      paymentStandingFromUnpaid(5, {
        homeUser: false,
        paymentsRequired: false,
        expectedAmount: 40,
      }),
      "exempt",
    );
    assert.equal(
      paymentStandingFromUnpaid(5, {
        homeUser: false,
        paymentsRequired: true,
        expectedAmount: 0,
      }),
      "exempt",
    );
  });

  test("sort rank puts red first", () => {
    assert.ok(standingSortRank("behind2plus") < standingSortRank("behind1"));
    assert.ok(standingSortRank("behind1") < standingSortRank("current"));
    assert.ok(standingSortRank("current") < standingSortRank("exempt"));
  });
});

describe("payment overdue lock", () => {
  test("billingStartPeriod uses paymentsRequiredSince when set", () => {
    const start = billingStartPeriod({
      paymentsRequired: true,
      paymentsRequiredSince: new Date(2026, 9, 1), // Oct
      createdAt: new Date(2026, 0, 15),
    });
    assert.deepEqual(start, { year: 2026, month: 10 });
  });

  test("billingStartPeriod is null when payments off", () => {
    assert.equal(
      billingStartPeriod({
        paymentsRequired: false,
        paymentsRequiredSince: null,
        createdAt: new Date(2026, 0, 1),
      }),
      null,
    );
  });

  test("no overdue in the first billed month even if unpaid", () => {
    assert.equal(
      hasOverdueUnpaidMonths({
        billingStart: { year: 2026, month: 10 },
        current: { year: 2026, month: 10 },
        paidKeys: new Set(),
      }),
      false,
    );
  });

  test("overdue on the 1st of the following month if previous unpaid", () => {
    assert.equal(
      hasOverdueUnpaidMonths({
        billingStart: { year: 2026, month: 10 },
        current: { year: 2026, month: 11 },
        paidKeys: new Set(),
      }),
      true,
    );
  });

  test("no overdue next month once previous month is paid", () => {
    assert.equal(
      hasOverdueUnpaidMonths({
        billingStart: { year: 2026, month: 10 },
        current: { year: 2026, month: 11 },
        paidKeys: new Set([periodKey(2026, 10)]),
      }),
      false,
    );
  });

  test("access stays open for current-month-only unpaid", () => {
    assert.equal(
      isPaymentAccessBlocked({
        homeUser: false,
        paymentsRequired: true,
        expectedAmount: 40,
        billingStart: { year: 2026, month: 10 },
        current: { year: 2026, month: 10 },
        paidKeys: new Set(),
      }),
      false,
    );
  });

  test("access blocks when a past billed month is unpaid", () => {
    assert.equal(
      isPaymentAccessBlocked({
        homeUser: false,
        paymentsRequired: true,
        expectedAmount: 40,
        billingStart: { year: 2026, month: 10 },
        current: { year: 2026, month: 11 },
        paidKeys: new Set(),
      }),
      true,
    );
  });

  test("access ignores payments-off and zero fee", () => {
    assert.equal(
      isPaymentAccessBlocked({
        homeUser: false,
        paymentsRequired: false,
        expectedAmount: 40,
        billingStart: null,
        current: { year: 2026, month: 11 },
        paidKeys: new Set(),
      }),
      false,
    );
    assert.equal(
      isPaymentAccessBlocked({
        homeUser: false,
        paymentsRequired: true,
        expectedAmount: 0,
        billingStart: { year: 2026, month: 10 },
        current: { year: 2026, month: 11 },
        paidKeys: new Set(),
      }),
      false,
    );
  });
});

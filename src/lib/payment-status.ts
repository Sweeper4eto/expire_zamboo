export type BillingPeriod = { year: number; month: number };

export type PaymentStanding = "current" | "behind1" | "behind2plus" | "exempt";

export function periodKey(year: number, month: number): string {
  return `${year}-${month}`;
}

export function comparePeriods(a: BillingPeriod, b: BillingPeriod): number {
  if (a.year !== b.year) return a.year - b.year;
  return a.month - b.month;
}

export function addMonths(period: BillingPeriod, delta: number): BillingPeriod {
  const date = new Date(period.year, period.month - 1 + delta, 1);
  return { year: date.getFullYear(), month: date.getMonth() + 1 };
}

export function periodFromDate(date: Date): BillingPeriod {
  return { year: date.getFullYear(), month: date.getMonth() + 1 };
}

/** Local calendar month start used when payments are turned on. */
export function startOfBillingMonth(date = new Date()): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

/**
 * First month that counts toward unpaid standing / overdue lock.
 * Prefer paymentsRequiredSince; fall back to createdAt for legacy rows.
 */
export function billingStartPeriod(options: {
  paymentsRequired: boolean;
  paymentsRequiredSince: Date | null | undefined;
  createdAt: Date;
}): BillingPeriod | null {
  if (!options.paymentsRequired) return null;
  const since = options.paymentsRequiredSince ?? options.createdAt;
  return periodFromDate(since);
}

/** Inclusive list of calendar months from start through end. */
export function monthsInclusive(
  start: BillingPeriod,
  end: BillingPeriod,
): BillingPeriod[] {
  if (comparePeriods(start, end) > 0) return [];
  const months: BillingPeriod[] = [];
  let cursor = start;
  while (comparePeriods(cursor, end) <= 0) {
    months.push(cursor);
    cursor = addMonths(cursor, 1);
  }
  return months;
}

/**
 * Count months since billing start through `through` that have no payment.
 * One payment covers the whole client (all locations).
 */
export function countUnpaidMonths(options: {
  billingStart: BillingPeriod;
  through: BillingPeriod;
  paidKeys: ReadonlySet<string>;
}): number {
  const months = monthsInclusive(options.billingStart, options.through);
  let unpaid = 0;
  for (const period of months) {
    if (!options.paidKeys.has(periodKey(period.year, period.month))) {
      unpaid += 1;
    }
  }
  return unpaid;
}

/**
 * True when any billed month *before* the current month is still unpaid.
 * Current month may stay unpaid without locking (pay anytime this month).
 * Example: payments on from Oct → lock starts Nov 1 if Oct is unpaid.
 */
export function hasOverdueUnpaidMonths(options: {
  billingStart: BillingPeriod;
  current: BillingPeriod;
  paidKeys: ReadonlySet<string>;
}): boolean {
  const through = addMonths(options.current, -1);
  if (comparePeriods(options.billingStart, through) > 0) {
    return false;
  }
  return (
    countUnpaidMonths({
      billingStart: options.billingStart,
      through,
      paidKeys: options.paidKeys,
    }) > 0
  );
}

/** Pure access gate used by clientRequiresPayment. */
export function isPaymentAccessBlocked(options: {
  homeUser: boolean;
  paymentsRequired: boolean;
  expectedAmount: number;
  billingStart: BillingPeriod | null;
  current: BillingPeriod;
  paidKeys: ReadonlySet<string>;
}): boolean {
  if (
    options.homeUser ||
    !options.paymentsRequired ||
    options.expectedAmount <= 0 ||
    !options.billingStart
  ) {
    return false;
  }
  return hasOverdueUnpaidMonths({
    billingStart: options.billingStart,
    current: options.current,
    paidKeys: options.paidKeys,
  });
}

export function paymentStandingFromUnpaid(
  unpaidMonths: number,
  options: {
    homeUser: boolean;
    paymentsRequired: boolean;
    expectedAmount: number;
  },
): PaymentStanding {
  if (options.homeUser) return "exempt";
  // Payments off, or nothing to collect → yellow (exempt), not paid-up green.
  if (!options.paymentsRequired || options.expectedAmount <= 0) {
    return "exempt";
  }
  if (unpaidMonths <= 0) return "current";
  if (unpaidMonths === 1) return "behind1";
  return "behind2plus";
}

export function standingSortRank(standing: PaymentStanding): number {
  switch (standing) {
    case "behind2plus":
      return 0;
    case "behind1":
      return 1;
    case "current":
      return 2;
    case "exempt":
      return 3;
  }
}

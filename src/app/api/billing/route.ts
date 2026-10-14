import { NextResponse } from "next/server";
import { requireClientOwner } from "@/lib/client-owner";
import { db } from "@/lib/db";
import { paymentAmount } from "@/lib/expiry";
import { sumLocationFees } from "@/lib/location-fees";
import {
  addMonths,
  billingStartPeriod,
  comparePeriods,
  countUnpaidMonths,
  monthsInclusive,
  paymentStandingFromUnpaid,
  periodFromDate,
  periodKey,
} from "@/lib/payment-status";
import { apiT } from "@/i18n";

const HISTORY_MONTH_CAP = 36;

export async function GET(request: Request) {
  let session;
  try {
    session = await requireClientOwner();
  } catch {
    return NextResponse.json(
      { error: apiT(request, "errors.forbidden") },
      { status: 403 },
    );
  }

  const client = await db.client.findUnique({
    where: { id: session.clientId },
    include: {
      stores: { select: { id: true, name: true, active: true, monthlyFee: true } },
      payments: {
        select: { year: true, month: true, amountPaid: true, paidAt: true },
        orderBy: [{ year: "desc" }, { month: "desc" }],
      },
    },
  });

  if (!client?.active) {
    return NextResponse.json(
      { error: apiT(request, "errors.forbidden") },
      { status: 403 },
    );
  }

  const activeStores = client.stores.filter((s) => s.active);
  const locationsFeeTotal = sumLocationFees(activeStores);
  const expectedAmount = paymentAmount(locationsFeeTotal, 0);
  const enabled =
    !client.homeUser && client.paymentsRequired && expectedAmount > 0;

  if (!enabled) {
    return NextResponse.json({
      enabled: false,
      standing: "exempt" as const,
      expectedAmount,
      activeStoreCount: activeStores.length,
      locationsFeeTotal,
      currentMonthPaid: false,
      months: [] as Array<{
        year: number;
        month: number;
        paid: boolean;
        amount: number | null;
      }>,
    });
  }

  const current = periodFromDate(new Date());
  const start = billingStartPeriod({
    paymentsRequired: client.paymentsRequired,
    paymentsRequiredSince: client.paymentsRequiredSince,
    createdAt: client.createdAt,
  });

  const paidByKey = new Map(
    client.payments.map((p) => [
      periodKey(p.year, p.month),
      { amount: p.amountPaid, paidAt: p.paidAt },
    ]),
  );
  const paidKeys = new Set(
    client.payments.map((p) => periodKey(p.year, p.month)),
  );
  const unpaidMonths =
    start != null
      ? countUnpaidMonths({
          billingStart: start,
          through: current,
          paidKeys,
        })
      : 0;

  const standing = paymentStandingFromUnpaid(unpaidMonths, {
    homeUser: client.homeUser,
    paymentsRequired: client.paymentsRequired,
    expectedAmount,
  });

  const historyStart =
    start != null
      ? comparePeriods(start, addMonths(current, -(HISTORY_MONTH_CAP - 1))) > 0
        ? start
        : addMonths(current, -(HISTORY_MONTH_CAP - 1))
      : current;

  const months = monthsInclusive(historyStart, current)
    .map((period) => {
      const key = periodKey(period.year, period.month);
      const payment = paidByKey.get(key);
      return {
        year: period.year,
        month: period.month,
        paid: Boolean(payment),
        amount: payment?.amount ?? null,
      };
    })
    .reverse();

  const currentKey = periodKey(current.year, current.month);
  const feeBreakdown = activeStores.map((s) => ({
    id: s.id,
    name: s.name,
    monthlyFee: s.monthlyFee,
  }));

  return NextResponse.json({
    enabled: true,
    standing,
    unpaidMonths,
    expectedAmount,
    activeStoreCount: activeStores.length,
    locationsFeeTotal,
    currentMonthPaid: paidKeys.has(currentKey),
    currentYear: current.year,
    currentMonth: current.month,
    feeBreakdown,
    months,
  });
}

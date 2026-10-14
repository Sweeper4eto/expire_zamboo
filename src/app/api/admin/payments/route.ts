import { NextResponse } from "next/server";
import { z } from "zod";
import { auditPaymentRecorded } from "@/lib/audit-details";
import { logAuditEvent } from "@/lib/audit-log";
import { requireAdmin } from "@/lib/auth";
import { paymentAmount } from "@/lib/expiry";
import { db } from "@/lib/db";
import { sumLocationFees } from "@/lib/location-fees";
import { apiT } from "@/i18n";
import {
  billingStartPeriod,
  countUnpaidMonths,
  paymentStandingFromUnpaid,
  periodFromDate,
  periodKey,
  standingSortRank,
} from "@/lib/payment-status";

async function requireAdminResponse(request: Request) {
  try {
    return await requireAdmin();
  } catch {
    return NextResponse.json(
      { error: apiT(request, "errors.forbidden") },
      { status: 403 },
    );
  }
}

const paymentSchema = z.object({
  clientId: z.string().min(1),
  year: z.number().int(),
  month: z.number().int().min(1).max(12),
  discount: z.number().nonnegative().default(0),
  notes: z.string().optional(),
});

export async function GET(request: Request) {
  const admin = await requireAdminResponse(request);
  if (admin instanceof NextResponse) return admin;

  const { searchParams } = new URL(request.url);
  const year = Number(searchParams.get("year"));
  const month = Number(searchParams.get("month"));
  const clientId = (searchParams.get("clientId") ?? "").trim();
  const statusList = searchParams.get("status") === "1";

  if (statusList) {
    const through = periodFromDate(new Date());
    const clients = await db.client.findMany({
      include: {
        stores: { select: { id: true, active: true, monthlyFee: true } },
        payments: { select: { year: true, month: true } },
        _count: { select: { referrals: true } },
      },
      orderBy: { name: "asc" },
    });

    const rows = clients.map((client) => {
      const activeStores = client.stores.filter((s) => s.active);
      const activeStoreCount = activeStores.length;
      const locationsFeeTotal = sumLocationFees(activeStores);
      const expectedAmount = paymentAmount(locationsFeeTotal, 0);
      const paidKeys = new Set(
        client.payments.map((p) => periodKey(p.year, p.month)),
      );
      const tracksPayments =
        !client.homeUser &&
        client.paymentsRequired &&
        expectedAmount > 0;
      const start = billingStartPeriod({
        paymentsRequired: client.paymentsRequired,
        paymentsRequiredSince: client.paymentsRequiredSince,
        createdAt: client.createdAt,
      });
      const unpaidMonths =
        tracksPayments && start
          ? countUnpaidMonths({
              billingStart: start,
              through,
              paidKeys,
            })
          : 0;
      const standing = paymentStandingFromUnpaid(unpaidMonths, {
        homeUser: client.homeUser,
        paymentsRequired: client.paymentsRequired,
        expectedAmount,
      });
      return {
        client: {
          id: client.id,
          name: client.name,
          active: client.active,
          homeUser: client.homeUser,
          paymentsRequired: client.paymentsRequired,
          locationsFeeTotal,
          referralCount: client._count.referrals,
          createdAt: client.createdAt.toISOString(),
        },
        activeStoreCount,
        storeCount: client.stores.length,
        expectedAmount,
        unpaidMonths,
        standing,
      };
    });

    rows.sort((a, b) => {
      const rank = standingSortRank(a.standing) - standingSortRank(b.standing);
      if (rank !== 0) return rank;
      return a.client.name.localeCompare(b.client.name);
    });

    return NextResponse.json({ through, rows });
  }

  if (clientId) {
    const client = await db.client.findUnique({
      where: { id: clientId },
      include: {
        stores: { orderBy: { name: "asc" } },
        referredBy: { select: { id: true, name: true, active: true } },
        referrals: {
          where: { active: true },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        },
      },
    });
    if (!client) {
      return NextResponse.json(
        { error: apiT(request, "errors.clientNotFound") },
        { status: 404 },
      );
    }

    const allPayments = await db.payment.findMany({
      where: { clientId },
      orderBy: [{ year: "desc" }, { month: "desc" }],
    });

    const paidKeys = new Set(
      allPayments.map((p) => periodKey(p.year, p.month)),
    );
    const through = periodFromDate(new Date());
    const activeStores = client.stores.filter((s) => s.active);
    const activeStoreCount = activeStores.length;
    const locationsFeeTotal = sumLocationFees(activeStores);
    const expectedAmount = paymentAmount(locationsFeeTotal, 0);
    const tracksPayments =
      !client.homeUser &&
      client.paymentsRequired &&
      expectedAmount > 0;
    const start = billingStartPeriod({
      paymentsRequired: client.paymentsRequired,
      paymentsRequiredSince: client.paymentsRequiredSince,
      createdAt: client.createdAt,
    });
    const unpaidMonths =
      tracksPayments && start
        ? countUnpaidMonths({
            billingStart: start,
            through,
            paidKeys,
          })
        : 0;
    const standing = paymentStandingFromUnpaid(unpaidMonths, {
      homeUser: client.homeUser,
      paymentsRequired: client.paymentsRequired,
      expectedAmount,
    });

    return NextResponse.json({
      client: {
        id: client.id,
        name: client.name,
        active: client.active,
        homeUser: client.homeUser,
        paymentsRequired: client.paymentsRequired,
        referredByClientId: client.referredByClientId,
        locationsFeeTotal,
        createdAt: client.createdAt.toISOString(),
      },
      referredBy: client.referredBy,
      referrals: client.referrals,
      stores: client.stores.map((store) => ({
        id: store.id,
        name: store.name,
        active: store.active,
        monthlyFee: store.monthlyFee,
      })),
      activeStoreCount,
      locationsFeeTotal,
      expectedAmount,
      unpaidMonths,
      standing,
      payments: allPayments.slice(0, 36),
    });
  }

  const payments = await db.payment.findMany({
    where: {
      ...(year ? { year } : {}),
      ...(month ? { month } : {}),
    },
    include: { client: { select: { id: true, name: true, active: true } } },
    orderBy: [{ year: "desc" }, { month: "desc" }],
  });

  return NextResponse.json({ payments });
}

export async function POST(request: Request) {
  const admin = await requireAdminResponse(request);
  if (admin instanceof NextResponse) return admin;

  const json = await request.json().catch(() => null);
  const parsed = paymentSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: apiT(request, "errors.invalidData") },
      { status: 400 },
    );
  }

  const client = await db.client.findUnique({
    where: { id: parsed.data.clientId },
    include: { stores: { where: { active: true } } },
  });
  if (!client) {
    return NextResponse.json(
      { error: apiT(request, "errors.clientNotFound") },
      { status: 404 },
    );
  }

  const activeStoreCount = client.stores.length;
  const locationsFeeTotal = sumLocationFees(client.stores);
  const amountPaid = paymentAmount(locationsFeeTotal, parsed.data.discount);

  const payment = await db.payment.upsert({
    where: {
      clientId_year_month: {
        clientId: client.id,
        year: parsed.data.year,
        month: parsed.data.month,
      },
    },
    create: {
      clientId: client.id,
      year: parsed.data.year,
      month: parsed.data.month,
      activeStoreCount,
      feePerStore: locationsFeeTotal,
      discount: parsed.data.discount,
      amountPaid,
      notes: parsed.data.notes,
    },
    update: {
      activeStoreCount,
      feePerStore: locationsFeeTotal,
      discount: parsed.data.discount,
      amountPaid,
      notes: parsed.data.notes,
      paidAt: new Date(),
    },
  });

  await logAuditEvent(
    request,
    admin,
    "payment_recorded",
    auditPaymentRecorded({
      clientName: client.name,
      year: parsed.data.year,
      month: parsed.data.month,
      activeStoreCount,
      feePerStore: locationsFeeTotal,
      discount: parsed.data.discount,
      amountPaid,
      notes: parsed.data.notes,
    }),
  );

  return NextResponse.json({ payment }, { status: 201 });
}

export async function DELETE(request: Request) {
  const admin = await requireAdminResponse(request);
  if (admin instanceof NextResponse) return admin;

  const { searchParams } = new URL(request.url);
  const clientId = (searchParams.get("clientId") ?? "").trim();
  const year = Number(searchParams.get("year"));
  const month = Number(searchParams.get("month"));
  if (!clientId || !year || !month) {
    return NextResponse.json(
      { error: apiT(request, "errors.invalidData") },
      { status: 400 },
    );
  }

  try {
    await db.payment.delete({
      where: {
        clientId_year_month: { clientId, year, month },
      },
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: apiT(request, "errors.entryNotFound") },
      { status: 404 },
    );
  }
}

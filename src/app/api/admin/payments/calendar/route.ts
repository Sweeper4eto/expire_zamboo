import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { paymentAmount } from "@/lib/expiry";
import { db } from "@/lib/db";
import { sumLocationFees } from "@/lib/location-fees";
import { apiT } from "@/i18n";

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

export async function GET(request: Request) {
  const admin = await requireAdminResponse(request);
  if (admin instanceof NextResponse) return admin;

  const { searchParams } = new URL(request.url);
  const year = Number(searchParams.get("year"));
  const month = Number(searchParams.get("month"));
  const calendar = searchParams.get("calendar") === "1";

  if (!calendar) {
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

  if (!year || !month) {
    return NextResponse.json(
      { error: apiT(request, "errors.missingYearMonth") },
      { status: 400 },
    );
  }

  const [clients, payments] = await Promise.all([
    db.client.findMany({
      where: { active: true, homeUser: false },
      include: {
        stores: {
          where: { active: true },
          select: { monthlyFee: true },
        },
      },
      orderBy: { name: "asc" },
    }),
    db.payment.findMany({ where: { year, month } }),
  ]);

  const paymentByClient = new Map(payments.map((p) => [p.clientId, p]));

  const rows = clients.map((client) => {
    const activeStoreCount = client.stores.length;
    const locationsFeeTotal = sumLocationFees(client.stores);
    const expectedAmount = paymentAmount(locationsFeeTotal, 0);
    const payment = paymentByClient.get(client.id);
    return {
      client: {
        id: client.id,
        name: client.name,
        locationsFeeTotal,
        paymentsRequired: client.paymentsRequired,
      },
      activeStoreCount,
      expectedAmount,
      paid: Boolean(payment),
      payment: payment ?? null,
    };
  });

  return NextResponse.json({ year, month, rows });
}

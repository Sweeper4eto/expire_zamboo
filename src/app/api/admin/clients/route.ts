import { NextResponse } from "next/server";
import { z } from "zod";
import { logAuditEvent } from "@/lib/audit-log";
import { auditClientCreated, auditClientDeleted, auditClientUpdated } from "@/lib/audit-details";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { clientDefaultsSchema, clientDefaultsToData } from "@/lib/expiry-notification-prefs";
import { startOfBillingMonth } from "@/lib/payment-status";
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
  const q = searchParams.get("q")?.trim();
  const businessOnly = searchParams.get("businessOnly") === "1";

  const clients = await db.client.findMany({
    where: {
      ...(businessOnly ? { homeUser: false } : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q } },
              { phone: { contains: q } },
              { additionalInfo: { contains: q } },
            ],
          }
        : {}),
    },
    orderBy: { name: "asc" },
    include: {
      _count: { select: { stores: true, users: true, referrals: true } },
      referredBy: { select: { id: true, name: true } },
      referrals: {
        where: { active: true },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      },
    },
  });

  return NextResponse.json({ clients });
}

const clientSchema = z.object({
  name: z.string().min(1),
  phone: z.string().optional(),
  additionalInfo: z.string().optional(),
  monthlyFeePerStore: z.number().nonnegative().optional(),
  active: z.boolean().optional(),
  homeUser: z.boolean().optional(),
  scheduleEnabled: z.boolean().optional(),
  paymentsRequired: z.boolean().optional(),
  referredByClientId: z.string().min(1).nullable().optional(),
});

export async function POST(request: Request) {
  const admin = await requireAdminResponse(request);
  if (admin instanceof NextResponse) return admin;

  const json = await request.json().catch(() => null);
  const parsed = clientSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: apiT(request, "errors.invalidData") },
      { status: 400 },
    );
  }

  const { referredByClientId, ...rest } = parsed.data;
  const homeUser = rest.homeUser ?? false;
  if (referredByClientId && homeUser) {
    return NextResponse.json(
      { error: apiT(request, "errors.invalidData") },
      { status: 400 },
    );
  }
  if (referredByClientId) {
    const referrer = await db.client.findUnique({
      where: { id: referredByClientId },
      select: { id: true, homeUser: true },
    });
    if (!referrer || referrer.homeUser) {
      return NextResponse.json(
        { error: apiT(request, "errors.invalidData") },
        { status: 400 },
      );
    }
  }

  const paymentsRequired = rest.paymentsRequired ?? false;
  const client = await db.client.create({
    data: {
      ...rest,
      referredByClientId: referredByClientId ?? null,
      scheduleEnabled: rest.scheduleEnabled ?? true,
      paymentsRequired,
      paymentsRequiredSince: paymentsRequired ? startOfBillingMonth() : null,
    },
  });
  await logAuditEvent(request, admin, "client_created", auditClientCreated(client));
  return NextResponse.json({ client }, { status: 201 });
}

const patchSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).optional(),
  phone: z.string().optional(),
  additionalInfo: z.string().optional(),
  monthlyFeePerStore: z.number().nonnegative().optional(),
  active: z.boolean().optional(),
  homeUser: z.boolean().optional(),
  scheduleEnabled: z.boolean().optional(),
  paymentsRequired: z.boolean().optional(),
  referredByClientId: z.string().min(1).nullable().optional(),
  notificationDefaults: clientDefaultsSchema.optional(),
  clearNotificationDefaults: z.boolean().optional(),
});

export async function PATCH(request: Request) {
  const admin = await requireAdminResponse(request);
  if (admin instanceof NextResponse) return admin;

  const json = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: apiT(request, "errors.invalidData") },
      { status: 400 },
    );
  }

  const {
    id,
    notificationDefaults,
    clearNotificationDefaults,
    referredByClientId,
    ...data
  } = parsed.data;
  const before = await db.client.findUnique({ where: { id } });
  if (!before) {
    return NextResponse.json(
      { error: apiT(request, "errors.clientNotFound") },
      { status: 404 },
    );
  }

  if (referredByClientId !== undefined) {
    if (referredByClientId === id) {
      return NextResponse.json(
        { error: apiT(request, "errors.invalidData") },
        { status: 400 },
      );
    }
    const willBeHome =
      data.homeUser !== undefined ? data.homeUser : before.homeUser;
    if (referredByClientId && willBeHome) {
      return NextResponse.json(
        { error: apiT(request, "errors.invalidData") },
        { status: 400 },
      );
    }
    if (referredByClientId) {
      const referrer = await db.client.findUnique({
        where: { id: referredByClientId },
        select: { id: true, homeUser: true },
      });
      if (!referrer || referrer.homeUser) {
        return NextResponse.json(
          { error: apiT(request, "errors.invalidData") },
          { status: 400 },
        );
      }
    }
  }

  const defaultsPatch = clearNotificationDefaults
    ? {
        expiryDefaultEarlyDays: null,
        expiryDefaultUrgentDays: null,
        expiryDefaultSchedule: null,
        expiryDefaultTime1: null,
        expiryDefaultTime2: null,
        expiryDefaultMinIntervalHours: null,
        expiryDefaultQuietEnabled: null,
        expiryDefaultQuietStart: null,
        expiryDefaultQuietEnd: null,
        expiryDefaultTimezone: null,
      }
    : notificationDefaults
      ? clientDefaultsToData(notificationDefaults)
      : {};

  const paymentsSincePatch: {
    paymentsRequiredSince?: Date | null;
  } = {};
  if (data.paymentsRequired !== undefined) {
    if (data.paymentsRequired && !before.paymentsRequired) {
      paymentsSincePatch.paymentsRequiredSince = startOfBillingMonth();
    } else if (!data.paymentsRequired) {
      paymentsSincePatch.paymentsRequiredSince = null;
    }
  }

  const referralPatch =
    referredByClientId !== undefined
      ? { referredByClientId }
      : {};

  const client = await db.client.update({
    where: { id },
    data: { ...data, ...defaultsPatch, ...paymentsSincePatch, ...referralPatch },
  });
  await logAuditEvent(request, admin, "client_updated", auditClientUpdated(before, client));
  return NextResponse.json({ client });
}

export async function DELETE(request: Request) {
  const admin = await requireAdminResponse(request);
  if (admin instanceof NextResponse) return admin;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json(
      { error: apiT(request, "errors.missingId") },
      { status: 400 },
    );
  }

  const existing = await db.client.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json(
      { error: apiT(request, "errors.clientNotFound") },
      { status: 404 },
    );
  }

  await db.client.delete({ where: { id } });
  await logAuditEvent(request, admin, "client_deleted", auditClientDeleted(existing));
  return NextResponse.json({ ok: true });
}

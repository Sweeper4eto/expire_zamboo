import { NextResponse } from "next/server";
import { z } from "zod";
import {
  auditStoreCreated,
  auditStoreDeleted,
  auditStoreUpdated,
} from "@/lib/audit-details";
import { logAuditEvent } from "@/lib/audit-log";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { defaultFeeForLocationIndex } from "@/lib/location-fees";
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
  const clientId = searchParams.get("clientId");

  if (clientId) {
    const stores = await db.store.findMany({
      where: { clientId },
      orderBy: { name: "asc" },
    });
    return NextResponse.json({ stores });
  }

  return NextResponse.json(
    { error: apiT(request, "errors.missingClientId") },
    { status: 400 },
  );
}

const storeSchema = z.object({
  clientId: z.string().min(1),
  name: z.string().min(1),
  address: z.string().optional(),
  phone: z.string().optional(),
  additionalInfo: z.string().optional(),
  active: z.boolean().optional(),
  monthlyFee: z.number().nonnegative().optional(),
});

export async function POST(request: Request) {
  const admin = await requireAdminResponse(request);
  if (admin instanceof NextResponse) return admin;

  const json = await request.json().catch(() => null);
  const parsed = storeSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: apiT(request, "errors.invalidData") },
      { status: 400 },
    );
  }

  const existingCount = await db.store.count({
    where: { clientId: parsed.data.clientId },
  });
  const monthlyFee =
    parsed.data.monthlyFee ?? defaultFeeForLocationIndex(existingCount);

  const { monthlyFee: _ignored, ...rest } = parsed.data;
  const store = await db.store.create({
    data: { ...rest, monthlyFee },
  });

  // Business owners register without a location — link all OWNERS when admin adds one.
  const owners = await db.user.findMany({
    where: {
      clientId: parsed.data.clientId,
      clientRole: "OWNER",
      active: true,
    },
    select: { id: true },
  });
  if (owners.length > 0) {
    await db.userStore.createMany({
      data: owners.map((owner) => ({
        userId: owner.id,
        storeId: store.id,
      })),
    });
  }

  const client = await db.client.findUnique({
    where: { id: parsed.data.clientId },
    select: { name: true },
  });
  await logAuditEvent(
    request,
    admin,
    "store_created",
    auditStoreCreated(store, client?.name ?? parsed.data.clientId),
  );
  return NextResponse.json({ store }, { status: 201 });
}

const patchSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  additionalInfo: z.string().optional(),
  active: z.boolean().optional(),
  monthlyFee: z.number().nonnegative().optional(),
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

  const { id, ...data } = parsed.data;
  const before = await db.store.findUnique({
    where: { id },
    include: { client: { select: { name: true } } },
  });
  if (!before) {
    return NextResponse.json(
      { error: apiT(request, "errors.missingId") },
      { status: 404 },
    );
  }
  const store = await db.store.update({ where: { id }, data });
  await logAuditEvent(
    request,
    admin,
    "store_updated",
    auditStoreUpdated(before, store, before.client.name),
  );
  return NextResponse.json({ store });
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

  const existing = await db.store.findUnique({
    where: { id },
    include: { client: { select: { name: true } } },
  });
  if (!existing) {
    return NextResponse.json(
      { error: apiT(request, "errors.missingId") },
      { status: 404 },
    );
  }

  await db.store.delete({ where: { id } });
  await logAuditEvent(
    request,
    admin,
    "store_deleted",
    auditStoreDeleted(existing, existing.client.name),
  );
  return NextResponse.json({ ok: true });
}

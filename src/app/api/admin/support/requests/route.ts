import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { apiT } from "@/i18n";

async function adminOrForbidden(request: Request) {
  try {
    return await requireAdmin();
  } catch {
    return NextResponse.json(
      { error: apiT(request, "errors.forbidden") },
      { status: 403 },
    );
  }
}

const statusSchema = z.enum(["new", "in_progress", "done"]);

export async function GET(request: Request) {
  const admin = await adminOrForbidden(request);
  if (admin instanceof NextResponse) return admin;

  const { searchParams } = new URL(request.url);
  const statusParam = searchParams.get("status");
  const status = statusSchema.safeParse(statusParam ?? "new");
  const take = Math.min(
    200,
    Math.max(1, Number(searchParams.get("take") ?? "100") || 100),
  );

  const where = status.success && statusParam
    ? { status: status.data }
    : undefined;

  const rows = await db.supportRequest.findMany({
    where,
    orderBy: [{ createdAt: "desc" }],
    take,
    include: {
      user: { select: { username: true } },
      store: { select: { name: true } },
      client: { select: { name: true } },
    },
  });

  const countsRaw = await db.supportRequest.groupBy({
    by: ["status"],
    _count: { _all: true },
  });
  const counts = {
    new: 0,
    in_progress: 0,
    done: 0,
  };
  for (const item of countsRaw) {
    if (item.status === "new") counts.new = item._count._all;
    else if (item.status === "in_progress") counts.in_progress = item._count._all;
    else if (item.status === "done") counts.done = item._count._all;
  }

  return NextResponse.json({
    requests: rows.map((row) => ({
      id: row.id,
      topic: row.topic,
      status: row.status,
      contact: row.contact,
      message: row.message,
      adminNote: row.adminNote,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      resolvedAt: row.resolvedAt?.toISOString() ?? null,
      username: row.user?.username ?? "Guest",
      storeName: row.store?.name ?? null,
      clientName: row.client?.name ?? null,
    })),
    counts,
  });
}

const patchSchema = z.object({
  id: z.string().min(1),
  status: statusSchema.optional(),
  adminNote: z.string().trim().max(1000).optional(),
});

export async function PATCH(request: Request) {
  const admin = await adminOrForbidden(request);
  if (admin instanceof NextResponse) return admin;

  const json = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: apiT(request, "errors.invalidData") },
      { status: 400 },
    );
  }

  const nextStatus = parsed.data.status;
  const row = await db.supportRequest.update({
    where: { id: parsed.data.id },
    data: {
      ...(nextStatus ? { status: nextStatus } : {}),
      ...(parsed.data.adminNote !== undefined
        ? { adminNote: parsed.data.adminNote || null }
        : {}),
      ...(nextStatus === "done" ? { resolvedAt: new Date() } : {}),
      ...(nextStatus && nextStatus !== "done" ? { resolvedAt: null } : {}),
    },
    select: { id: true },
  });

  return NextResponse.json({ ok: true, id: row.id });
}

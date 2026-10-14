import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { apiT } from "@/i18n";
import { syncWhatsNewCatalog } from "@/lib/whats-new-sync";

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

function serialize(row: {
  id: string;
  sourceKey: string | null;
  titleEn: string;
  titleBg: string;
  href: string | null;
  active: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: row.id,
    sourceKey: row.sourceKey,
    titleEn: row.titleEn,
    titleBg: row.titleBg,
    href: row.href,
    active: row.active,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function GET(request: Request) {
  const admin = await adminOrForbidden(request);
  if (admin instanceof NextResponse) return admin;

  const sync = await syncWhatsNewCatalog();

  const items = await db.whatsNewItem.findMany({
    where: { suppressed: false },
    orderBy: [{ active: "desc" }, { sortOrder: "asc" }, { createdAt: "desc" }],
  });

  return NextResponse.json({
    items: items.map(serialize),
    sync,
  });
}

const createSchema = z.object({
  titleEn: z.string().trim().min(1).max(200),
  titleBg: z.string().trim().min(1).max(200),
  href: z
    .string()
    .trim()
    .max(300)
    .optional()
    .nullable()
    .transform((value) => {
      const trimmed = value?.trim() ?? "";
      return trimmed.length > 0 ? trimmed : null;
    }),
});

export async function POST(request: Request) {
  const admin = await adminOrForbidden(request);
  if (admin instanceof NextResponse) return admin;

  const json = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: apiT(request, "errors.invalidData") },
      { status: 400 },
    );
  }

  const maxSort = await db.whatsNewItem.aggregate({ _max: { sortOrder: true } });
  const row = await db.whatsNewItem.create({
    data: {
      titleEn: parsed.data.titleEn,
      titleBg: parsed.data.titleBg,
      href: parsed.data.href,
      active: false,
      sortOrder: (maxSort._max.sortOrder ?? 0) + 1,
    },
  });

  return NextResponse.json({ item: serialize(row) });
}

const patchSchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(100),
  action: z.enum(["push", "dismiss", "delete"]),
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

  const { ids, action } = parsed.data;

  if (action === "delete") {
    // Soft-delete so catalog sync does not recreate the same sourceKey on Refresh.
    const result = await db.whatsNewItem.updateMany({
      where: { id: { in: ids } },
      data: { suppressed: true, active: false },
    });
    return NextResponse.json({ ok: true, action, count: result.count });
  }

  const active = action === "push";
  const result = await db.whatsNewItem.updateMany({
    where: { id: { in: ids } },
    data: { active },
  });

  return NextResponse.json({ ok: true, action, count: result.count });
}
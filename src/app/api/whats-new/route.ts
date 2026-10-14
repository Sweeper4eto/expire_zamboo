import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { apiT, getLocaleFromRequest } from "@/i18n";

export async function GET(request: Request) {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json(
      { error: apiT(request, "errors.unauthorized") },
      { status: 401 },
    );
  }

  const locale = getLocaleFromRequest(request);
  const rows = await db.whatsNewItem.findMany({
    where: {
      active: true,
      suppressed: false,
      seenBy: { none: { userId: session.userId } },
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
  });

  const items = rows.map((row) => ({
    id: row.id,
    title: locale === "bg" ? row.titleBg : row.titleEn,
    href: row.href,
  }));

  return NextResponse.json({ items });
}

/** Mark What’s new items as seen for the current user (“Got it”). */
export async function POST(request: Request) {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json(
      { error: apiT(request, "errors.unauthorized") },
      { status: 401 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: apiT(request, "errors.invalidData") },
      { status: 400 },
    );
  }

  const idsRaw =
    body && typeof body === "object" && "ids" in body
      ? (body as { ids: unknown }).ids
      : null;
  if (!Array.isArray(idsRaw)) {
    return NextResponse.json(
      { error: apiT(request, "errors.invalidData") },
      { status: 400 },
    );
  }

  const ids = [
    ...new Set(
      idsRaw.filter(
        (value): value is string => typeof value === "string" && value.length > 0,
      ),
    ),
  ];
  if (ids.length === 0) {
    return NextResponse.json({ ok: true, marked: 0 });
  }

  const live = await db.whatsNewItem.findMany({
    where: { id: { in: ids }, active: true, suppressed: false },
    select: { id: true },
  });
  if (live.length === 0) {
    return NextResponse.json({ ok: true, marked: 0 });
  }

  const liveIds = live.map((item) => item.id);
  const already = await db.whatsNewSeen.findMany({
    where: { userId: session.userId, itemId: { in: liveIds } },
    select: { itemId: true },
  });
  const alreadySet = new Set(already.map((row) => row.itemId));
  const toCreate = liveIds.filter((id) => !alreadySet.has(id));
  if (toCreate.length > 0) {
    await db.whatsNewSeen.createMany({
      data: toCreate.map((itemId) => ({
        userId: session.userId,
        itemId,
      })),
    });
  }

  return NextResponse.json({ ok: true, marked: liveIds.length });
}

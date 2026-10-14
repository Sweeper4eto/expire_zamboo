import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { activeBuyListWhere } from "@/lib/buy-list";
import { filterInventoryEntriesBySearch } from "@/lib/inventory-search";
import { db } from "@/lib/db";
import { apiT } from "@/i18n";

export async function GET(request: Request) {
  try {
    await requireAdmin();
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "MUST_CHANGE_PASSWORD") {
      return NextResponse.json(
        { error: apiT(request, "auth.mustChangePassword"), code: "MUST_CHANGE_PASSWORD" },
        { status: 403 },
      );
    }
    return NextResponse.json(
      { error: apiT(request, "errors.forbidden") },
      { status: 403 },
    );
  }

  const { searchParams } = new URL(request.url);
  const storeId = searchParams.get("storeId");
  if (!storeId) {
    return NextResponse.json(
      { error: apiT(request, "errors.missingStoreId") },
      { status: 400 },
    );
  }

  const store = await db.store.findUnique({
    where: { id: storeId },
    select: {
      id: true,
      name: true,
      active: true,
      client: { select: { id: true, name: true, homeUser: true } },
    },
  });
  if (!store) {
    return NextResponse.json(
      { error: apiT(request, "errors.missingStoreId") },
      { status: 404 },
    );
  }
  if (!store.client?.homeUser) {
    return NextResponse.json(
      { error: apiT(request, "buyList.unavailable") },
      { status: 400 },
    );
  }

  const q = searchParams.get("q")?.trim() ?? "";
  const page = Math.max(1, Number.parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const limit = Math.min(
    50,
    Math.max(1, Number.parseInt(searchParams.get("limit") ?? "20", 10) || 20),
  );

  const where = {
    storeId,
    ...activeBuyListWhere,
  };
  const orderBy = { enteredAt: "desc" as const };

  if (q) {
    const candidates = await db.buyListEntry.findMany({
      where,
      include: { product: true },
      orderBy,
      take: 1000,
    });
    const entries = filterInventoryEntriesBySearch(candidates, q).slice(0, 100);
    return NextResponse.json({
      store,
      entries,
      pagination: {
        page: 1,
        limit: entries.length,
        total: entries.length,
        totalPages: 1,
      },
    });
  }

  const [entries, total] = await Promise.all([
    db.buyListEntry.findMany({
      where,
      include: { product: true },
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
    }),
    db.buyListEntry.count({ where }),
  ]);

  return NextResponse.json({
    store,
    entries,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  });
}
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  auditBuyListAdded,
  auditBuyListMerged,
  auditBuyListRemoved,
  auditBuyListUpdated,
} from "@/lib/audit-details";
import { logAuditEvent } from "@/lib/audit-log";
import { requireSession } from "@/lib/auth";
import { barcodeLookupValues, normalizeBarcode } from "@/lib/barcode";
import { activeBuyListWhere } from "@/lib/buy-list";
import { userCanAccessHomeStore } from "@/lib/home-user";
import {
  isAdhocBarcode,
  makeAdhocBarcode,
} from "@/lib/inventory-entry-display";
import { filterInventoryEntriesBySearch } from "@/lib/inventory-search";
import { db } from "@/lib/db";
import { deleteLocalProductIfUnused } from "@/lib/local-product";
import { deleteLocalUpload } from "@/lib/upload";
import { apiT } from "@/i18n";

const createSchema = z.object({
  storeId: z.string().min(1),
  barcode: z.string().optional(),
  productId: z.string().optional(),
  name: z.string().optional(),
  imagePath: z.string().nullable().optional(),
  quantity: z.number().int().positive(),
});

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

  const json = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: apiT(request, "errors.invalidData") },
      { status: 400 },
    );
  }

  const store = await userCanAccessHomeStore(session.userId, parsed.data.storeId);
  if (!store) {
    return NextResponse.json(
      { error: apiT(request, "errors.homeUserRequired") },
      { status: 403 },
    );
  }

  const barcode = normalizeBarcode(parsed.data.barcode ?? "") || null;
  const name = parsed.data.name?.trim() ?? "";
  const imagePath = parsed.data.imagePath?.trim() || null;

  let product = parsed.data.productId
    ? await db.product.findUnique({ where: { id: parsed.data.productId } })
    : null;

  if (product && barcode) {
    const ok = barcodeLookupValues(barcode).includes(product.barcode);
    if (!ok) {
      return NextResponse.json(
        { error: apiT(request, "errors.productNotFound") },
        { status: 404 },
      );
    }
  }

  if (!product && barcode) {
    product = await db.product.findFirst({
      where: { barcode: { in: barcodeLookupValues(barcode) } },
    });
  }

  if (!product) {
    if (!name && !imagePath) {
      return NextResponse.json(
        { error: apiT(request, "errors.invalidData") },
        { status: 400 },
      );
    }
    product = await db.product.create({
      data: {
        barcode: barcode || makeAdhocBarcode(),
        name,
        imagePath,
      },
    });
  }

  const existing = await db.buyListEntry.findFirst({
    where: {
      storeId: parsed.data.storeId,
      productId: product.id,
      ...activeBuyListWhere,
    },
    orderBy: { enteredAt: "asc" },
  });

  if (existing) {
    const entry = await db.buyListEntry.update({
      where: { id: existing.id },
      data: { quantity: existing.quantity + parsed.data.quantity },
      include: { product: true },
    });

    await logAuditEvent(
      request,
      session,
      "buy_list_merged",
      auditBuyListMerged({
        productName: product.name,
        barcode: product.barcode,
        addedQty: parsed.data.quantity,
        totalQty: entry.quantity,
        storeName: store.name,
      }),
    );

    return NextResponse.json({ entry, merged: true });
  }

  const entry = await db.buyListEntry.create({
    data: {
      storeId: parsed.data.storeId,
      productId: product.id,
      barcode: product.barcode,
      quantity: parsed.data.quantity,
    },
    include: { product: true },
  });

  await logAuditEvent(
    request,
    session,
    "buy_list_added",
    auditBuyListAdded({
      productName: product.name,
      barcode: product.barcode,
      quantity: parsed.data.quantity,
      storeName: store.name,
    }),
  );

  return NextResponse.json({ entry, merged: false }, { status: 201 });
}

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

  const { searchParams } = new URL(request.url);
  const storeId = searchParams.get("storeId");
  if (!storeId) {
    return NextResponse.json(
      { error: apiT(request, "errors.missingStoreId") },
      { status: 400 },
    );
  }

  const store = await userCanAccessHomeStore(session.userId, storeId);
  if (!store) {
    return NextResponse.json(
      { error: apiT(request, "errors.homeUserRequired") },
      { status: 403 },
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

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return NextResponse.json({
    entries,
    pagination: {
      page,
      limit,
      total,
      totalPages,
    },
  });
}

const patchSchema = z.object({
  entryId: z.string().min(1),
  storeId: z.string().min(1),
  quantity: z.number().int().positive().optional(),
  checked: z.boolean().optional(),
  imagePath: z.string().nullable().optional(),
  name: z.string().optional(),
  barcode: z.string().nullable().optional(),
});

export async function PATCH(request: Request) {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json(
      { error: apiT(request, "errors.unauthorized") },
      { status: 401 },
    );
  }

  const json = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: apiT(request, "errors.invalidData") },
      { status: 400 },
    );
  }

  const store = await userCanAccessHomeStore(session.userId, parsed.data.storeId);
  if (!store) {
    return NextResponse.json(
      { error: apiT(request, "errors.homeUserRequired") },
      { status: 403 },
    );
  }

  const hasFieldUpdate =
    parsed.data.quantity !== undefined ||
    parsed.data.checked !== undefined ||
    parsed.data.imagePath !== undefined ||
    parsed.data.name !== undefined ||
    parsed.data.barcode !== undefined;

  if (hasFieldUpdate) {
    const existing = await db.buyListEntry.findFirst({
      where: {
        id: parsed.data.entryId,
        storeId: parsed.data.storeId,
        ...activeBuyListWhere,
      },
      include: { product: true },
    });

    if (!existing) {
      return NextResponse.json(
        { error: apiT(request, "errors.entryNotFound") },
        { status: 404 },
      );
    }

    if (parsed.data.quantity !== undefined) {
      await db.buyListEntry.update({
        where: { id: existing.id },
        data: { quantity: parsed.data.quantity },
      });

      await logAuditEvent(
        request,
        session,
        "buy_list_updated",
        auditBuyListUpdated({
          productName: existing.product.name,
          barcode: existing.barcode,
          storeName: store.name,
          beforeQty: existing.quantity,
          afterQty: parsed.data.quantity,
        }),
      );
    }

    if (parsed.data.checked !== undefined) {
      await db.buyListEntry.update({
        where: { id: existing.id },
        data: { checkedAt: parsed.data.checked ? new Date() : null },
      });
    }

    const productData: { name?: string; imagePath?: string | null; barcode?: string } =
      {};

    if (parsed.data.imagePath !== undefined) {
      productData.imagePath = parsed.data.imagePath?.trim() || null;
    }
    if (parsed.data.name !== undefined) {
      productData.name = parsed.data.name.trim();
    }
    if (parsed.data.barcode !== undefined) {
      const normalized = normalizeBarcode(parsed.data.barcode ?? "");
      const nextBarcode = normalized || makeAdhocBarcode();
      if (nextBarcode !== existing.product.barcode) {
        const clash = await db.product.findFirst({
          where: {
            id: { not: existing.productId },
            barcode: { in: barcodeLookupValues(nextBarcode) },
          },
        });
        if (clash) {
          return NextResponse.json(
            { error: apiT(request, "errors.productExistsGlobal") },
            { status: 409 },
          );
        }
      }
      productData.barcode = nextBarcode;
    }

    if (Object.keys(productData).length > 0) {
      const product = await db.product.update({
        where: { id: existing.productId },
        data: productData,
      });

      if (
        productData.imagePath !== undefined &&
        existing.product.imagePath &&
        existing.product.imagePath !== product.imagePath
      ) {
        await deleteLocalUpload(existing.product.imagePath);
      }

      if (productData.barcode !== undefined) {
        await db.buyListEntry.update({
          where: { id: existing.id },
          data: { barcode: productData.barcode },
        });
      }
    }

    const entry = await db.buyListEntry.findFirst({
      where: { id: existing.id },
      include: { product: true },
    });

    return NextResponse.json({ entry });
  }

  const removed = await db.buyListEntry.findFirst({
    where: {
      id: parsed.data.entryId,
      storeId: parsed.data.storeId,
      ...activeBuyListWhere,
    },
    include: { product: true },
  });

  if (!removed) {
    return NextResponse.json(
      { error: apiT(request, "errors.entryNotFound") },
      { status: 404 },
    );
  }

  if (isAdhocBarcode(removed.barcode)) {
    await db.buyListEntry.delete({ where: { id: removed.id } });
    await deleteLocalProductIfUnused(removed.productId);
  } else {
    await db.buyListEntry.update({
      where: { id: removed.id },
      data: { removedAt: new Date() },
    });
  }

  await logAuditEvent(
    request,
    session,
    "buy_list_removed",
    auditBuyListRemoved({
      productName: removed.product.name,
      barcode: removed.barcode,
      quantity: removed.quantity,
      storeName: store.name,
    }),
  );

  return NextResponse.json({ ok: true });
}

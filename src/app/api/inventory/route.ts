import { NextResponse } from "next/server";
import { z } from "zod";
import {
  auditInventoryAdded,
  auditInventoryMerged,
  auditInventoryPriceReduced,
  auditInventoryPriceRestored,
  auditInventoryRemoved,
  auditInventoryUpdated,
} from "@/lib/audit-details";
import { logAuditEvent } from "@/lib/audit-log";
import { requireSession } from "@/lib/auth";
import { barcodeLookupValues, normalizeBarcode } from "@/lib/barcode";
import { expiryListDateBounds, parseExpiryWithinDays } from "@/lib/expiry";
import {
  activeInventoryWhere,
  expiryDateDayBounds,
  inventoryEntryInclude,
  normalizeExpiryDate,
  priceReducedOffData,
  priceReducedOnData,
} from "@/lib/inventory";
import { filterInventoryEntriesBySearch } from "@/lib/inventory-search";
import { db } from "@/lib/db";
import { userCanAccessStore } from "@/lib/store-access";
import { deleteLocalUpload } from "@/lib/upload";
import {
  isAdhocBarcode,
  makeAdhocBarcode,
} from "@/lib/inventory-entry-display";
import { deleteLocalProductIfUnused } from "@/lib/local-product";
import { apiT } from "@/i18n";

const createSchema = z.object({
  storeId: z.string().min(1),
  barcode: z.string().optional(),
  productId: z.string().optional(),
  name: z.string().optional(),
  articul: z.string().optional(),
  imagePath: z.string().nullable().optional(),
  quantity: z.number().int().positive(),
  expiryDate: z.string().datetime(),
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

  const store = await userCanAccessStore(session.userId, parsed.data.storeId);
  if (!store) {
    return NextResponse.json(
      { error: apiT(request, "errors.noStoreAccess") },
      { status: 403 },
    );
  }

  const articul = parsed.data.articul?.trim() || null;
  const entryImagePath = parsed.data.imagePath?.trim() || null;
  const name = parsed.data.name?.trim() ?? "";
  let product = parsed.data.productId
    ? await db.product.findUnique({ where: { id: parsed.data.productId } })
    : null;

  const barcode = normalizeBarcode(parsed.data.barcode ?? "") || null;
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
    const createBarcode = barcode || makeAdhocBarcode();
    try {
      product = await db.product.create({
        data: {
          barcode: createBarcode,
          name,
          imagePath: null,
        },
      });
    } catch (error) {
      const isUnique =
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        (error as { code: unknown }).code === "P2002";
      if (!isUnique) throw error;
      // Barcode already exists (race / missed lookup) — reuse it.
      product = barcode
        ? await db.product.findFirst({
            where: { barcode: { in: barcodeLookupValues(barcode) } },
          })
        : await db.product.findUnique({ where: { barcode: createBarcode } });
      if (!product && !barcode) {
        product = await db.product.create({
          data: {
            barcode: makeAdhocBarcode(),
            name,
            imagePath: null,
          },
        });
      }
      if (!product) throw error;
    }
  } else if (name && name !== product.name) {
    product = await db.product.update({
      where: { id: product.id },
      data: { name },
    });
  }

  const expiryDate = normalizeExpiryDate(new Date(parsed.data.expiryDate));
  const { start, end } = expiryDateDayBounds(expiryDate);

  const existing = await db.inventoryEntry.findFirst({
    where: {
      storeId: parsed.data.storeId,
      productId: product.id,
      ...activeInventoryWhere,
      expiryDate: { gte: start, lt: end },
    },
    orderBy: { enteredAt: "asc" },
  });

  if (existing) {
    const entry = await db.inventoryEntry.update({
      where: { id: existing.id },
      data: {
        quantity: existing.quantity + parsed.data.quantity,
        expiryDate,
        ...(articul ? { articul } : {}),
        ...(entryImagePath ? { imagePath: entryImagePath } : {}),
      },
      include: inventoryEntryInclude,
    });

    await logAuditEvent(
      request,
      session,
      "inventory_merged",
      auditInventoryMerged({
        productName: product.name,
        barcode: product.barcode,
        addedQty: parsed.data.quantity,
        totalQty: entry.quantity,
        storeName: store.name,
        expiryDate,
      }),
    );

    return NextResponse.json({ entry, merged: true });
  }

  const entry = await db.inventoryEntry.create({
    data: {
      storeId: parsed.data.storeId,
      productId: product.id,
      barcode: product.barcode,
      articul,
      imagePath: entryImagePath,
      quantity: parsed.data.quantity,
      expiryDate,
      addedByUserId: session.userId,
    },
    include: inventoryEntryInclude,
  });

  await logAuditEvent(
    request,
    session,
    "inventory_added",
    auditInventoryAdded({
      productName: product.name,
      barcode: product.barcode,
      quantity: parsed.data.quantity,
      storeName: store.name,
      expiryDate,
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

  const store = await userCanAccessStore(session.userId, storeId);
  if (!store) {
    return NextResponse.json(
      { error: apiT(request, "errors.noStoreAccess") },
      { status: 403 },
    );
  }

  const now = new Date();

  const withinDays = parseExpiryWithinDays(searchParams.get("withinDays"));
  const { maxPast, maxFuture } = expiryListDateBounds(now, withinDays);
  const q = searchParams.get("q")?.trim() ?? "";
  const page = Math.max(1, Number.parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const limit = Math.min(
    50,
    Math.max(1, Number.parseInt(searchParams.get("limit") ?? "20", 10) || 20),
  );

  const baseWhere = {
    storeId,
    ...activeInventoryWhere,
    ...(maxPast || maxFuture
      ? {
          expiryDate: {
            ...(maxPast ? { gte: maxPast } : {}),
            ...(maxFuture ? { lte: maxFuture } : {}),
          },
        }
      : {}),
  };

  const where = baseWhere;

  const orderBy = { expiryDate: "asc" as const };

  if (q) {
    const candidates = await db.inventoryEntry.findMany({
      where,
      include: inventoryEntryInclude,
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
    db.inventoryEntry.findMany({
      where,
      include: inventoryEntryInclude,
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
    }),
    db.inventoryEntry.count({ where }),
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
  expiryDate: z.string().datetime().optional(),
  priceReduced: z.boolean().optional(),
  priceDiscountPercent: z.number().int().min(5).max(100).optional(),
  articul: z.string().nullable().optional(),
  imagePath: z.string().nullable().optional(),
  name: z.string().nullable().optional(),
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

  const store = await userCanAccessStore(session.userId, parsed.data.storeId);
  if (!store) {
    return NextResponse.json(
      { error: apiT(request, "errors.noStoreAccess") },
      { status: 403 },
    );
  }

  const hasFieldUpdate =
    parsed.data.quantity !== undefined ||
    parsed.data.expiryDate !== undefined ||
    parsed.data.articul !== undefined ||
    parsed.data.imagePath !== undefined ||
    parsed.data.name !== undefined ||
    parsed.data.barcode !== undefined;
  const onlyPriceFlag =
    parsed.data.priceReduced !== undefined && !hasFieldUpdate;

  if (onlyPriceFlag && parsed.data.priceReduced === false) {
    const existing = await db.inventoryEntry.findFirst({
      where: {
        id: parsed.data.entryId,
        storeId: parsed.data.storeId,
        ...activeInventoryWhere,
      },
      include: inventoryEntryInclude,
    });

    if (!existing) {
      return NextResponse.json(
        { error: apiT(request, "errors.entryNotFound") },
        { status: 404 },
      );
    }

    if (!existing.priceReducedAt) {
      return NextResponse.json({ entry: existing });
    }

    const entry = await db.inventoryEntry.update({
      where: { id: existing.id },
      data: priceReducedOffData(),
      include: inventoryEntryInclude,
    });

    await logAuditEvent(
      request,
      session,
      "inventory_price_restored",
      auditInventoryPriceRestored({
        productName: existing.product.name,
        barcode: existing.barcode,
        quantity: existing.quantity,
        storeName: store.name,
        expiryDate: existing.expiryDate,
      }),
    );

    return NextResponse.json({ entry });
  }

  if (onlyPriceFlag && parsed.data.priceReduced === true) {
    const existing = await db.inventoryEntry.findFirst({
      where: {
        id: parsed.data.entryId,
        storeId: parsed.data.storeId,
        ...activeInventoryWhere,
      },
      include: inventoryEntryInclude,
    });

    if (!existing) {
      return NextResponse.json(
        { error: apiT(request, "errors.entryNotFound") },
        { status: 404 },
      );
    }

    const discountPercent = parsed.data.priceDiscountPercent;
    if (discountPercent === undefined) {
      return NextResponse.json(
        { error: apiT(request, "errors.invalidData") },
        { status: 400 },
      );
    }

    if (existing.priceReducedAt) {
      if (existing.priceDiscountPercent === discountPercent) {
        return NextResponse.json({ entry: existing });
      }

      const entry = await db.inventoryEntry.update({
        where: { id: existing.id },
        data: priceReducedOnData(session.userId, discountPercent),
        include: inventoryEntryInclude,
      });

      await logAuditEvent(
        request,
        session,
        "inventory_price_reduced",
        auditInventoryPriceReduced({
          productName: existing.product.name,
          barcode: existing.barcode,
          quantity: existing.quantity,
          storeName: store.name,
          expiryDate: existing.expiryDate,
          discountPercent,
        }),
      );

      return NextResponse.json({ entry });
    }

    const entry = await db.inventoryEntry.update({
      where: { id: existing.id },
      data: priceReducedOnData(session.userId, discountPercent),
      include: inventoryEntryInclude,
    });

    await logAuditEvent(
      request,
      session,
      "inventory_price_reduced",
      auditInventoryPriceReduced({
        productName: existing.product.name,
        barcode: existing.barcode,
        quantity: existing.quantity,
        storeName: store.name,
        expiryDate: existing.expiryDate,
        discountPercent,
      }),
    );

    return NextResponse.json({ entry });
  }

  const isUpdate =
    parsed.data.quantity !== undefined ||
    parsed.data.expiryDate !== undefined ||
    parsed.data.priceReduced !== undefined ||
    parsed.data.articul !== undefined ||
    parsed.data.imagePath !== undefined ||
    parsed.data.name !== undefined ||
    parsed.data.barcode !== undefined;

  if (isUpdate) {
    const existing = await db.inventoryEntry.findFirst({
      where: {
        id: parsed.data.entryId,
        storeId: parsed.data.storeId,
        ...activeInventoryWhere,
      },
      include: inventoryEntryInclude,
    });

    if (!existing) {
      return NextResponse.json(
        { error: apiT(request, "errors.entryNotFound") },
        { status: 404 },
      );
    }

    if (parsed.data.name !== undefined || parsed.data.barcode !== undefined) {
      const nextName =
        parsed.data.name !== undefined
          ? (parsed.data.name?.trim() ?? "")
          : existing.product.name;
      let nextBarcode = existing.barcode;
      if (parsed.data.barcode !== undefined) {
        const normalized = normalizeBarcode(parsed.data.barcode ?? "");
        nextBarcode = normalized || makeAdhocBarcode();
        if (nextBarcode !== existing.barcode) {
          const clash = await db.product.findFirst({
            where: {
              barcode: { in: barcodeLookupValues(nextBarcode) },
              NOT: { id: existing.productId },
            },
          });
          if (clash) {
            return NextResponse.json(
              { error: apiT(request, "errors.productExistsGlobal") },
              { status: 409 },
            );
          }
        }
      }
      await db.product.update({
        where: { id: existing.productId },
        data: {
          name: nextName,
          barcode: nextBarcode,
        },
      });
      if (nextBarcode !== existing.barcode) {
        await db.inventoryEntry.updateMany({
          where: { productId: existing.productId },
          data: { barcode: nextBarcode },
        });
      }
      existing.barcode = nextBarcode;
      existing.product.name = nextName;
      existing.product.barcode = nextBarcode;
    }

    const entryFieldUpdate =
      parsed.data.quantity !== undefined ||
      parsed.data.expiryDate !== undefined ||
      parsed.data.articul !== undefined ||
      parsed.data.imagePath !== undefined ||
      parsed.data.priceReduced !== undefined;

    if (!entryFieldUpdate) {
      const entry = await db.inventoryEntry.findUniqueOrThrow({
        where: { id: existing.id },
        include: inventoryEntryInclude,
      });
      return NextResponse.json({ entry });
    }

    const nextQuantity = parsed.data.quantity ?? existing.quantity;
    const nextExpiry = parsed.data.expiryDate
      ? normalizeExpiryDate(new Date(parsed.data.expiryDate))
      : existing.expiryDate;

    if (parsed.data.expiryDate) {
      const { start, end } = expiryDateDayBounds(nextExpiry);
      const conflict = await db.inventoryEntry.findFirst({
        where: {
          storeId: parsed.data.storeId,
          productId: existing.productId,
          id: { not: parsed.data.entryId },
          ...activeInventoryWhere,
          expiryDate: { gte: start, lt: end },
        },
        include: inventoryEntryInclude,
      });

      if (conflict) {
        const mergedEntry = await db.$transaction(async (tx) => {
          await tx.inventoryEntry.update({
            where: { id: conflict.id },
            data: {
              quantity: conflict.quantity + nextQuantity,
              ...(existing.priceReducedAt && !conflict.priceReducedAt
                ? {
                    priceReducedAt: existing.priceReducedAt,
                    priceDiscountPercent: existing.priceDiscountPercent,
                    priceReducedByUserId: existing.priceReducedByUserId,
                  }
                : {}),
            },
          });
          // Merged-away row: hard-delete for local products so soft-removed
          // NB… rows do not keep scaffolding products alive.
          if (isAdhocBarcode(existing.barcode)) {
            await tx.inventoryEntry.delete({ where: { id: existing.id } });
          } else {
            await tx.inventoryEntry.update({
              where: { id: existing.id },
              data: { removedAt: new Date() },
            });
          }
          return tx.inventoryEntry.findUniqueOrThrow({
            where: { id: conflict.id },
            include: inventoryEntryInclude,
          });
        });

        await logAuditEvent(
          request,
          session,
          "inventory_merged",
          auditInventoryMerged({
            productName: existing.product.name,
            barcode: existing.barcode,
            addedQty: nextQuantity,
            totalQty: mergedEntry.quantity,
            storeName: store.name,
            expiryDate: nextExpiry,
          }),
        );

        return NextResponse.json({
          entry: mergedEntry,
          merged: true,
          removedId: existing.id,
        });
      }
    }

    const entry = await db.inventoryEntry.update({
      where: { id: existing.id },
      data: {
        ...(parsed.data.quantity !== undefined
          ? { quantity: parsed.data.quantity }
          : {}),
        ...(parsed.data.expiryDate !== undefined
          ? { expiryDate: nextExpiry }
          : {}),
        ...(parsed.data.articul !== undefined
          ? { articul: parsed.data.articul?.trim() || null }
          : {}),
        ...(parsed.data.imagePath !== undefined
          ? { imagePath: parsed.data.imagePath?.trim() || null }
          : {}),
        ...(parsed.data.priceReduced === true && !existing.priceReducedAt
          ? priceReducedOnData(
              session.userId,
              parsed.data.priceDiscountPercent ?? 25,
            )
          : {}),
        ...(parsed.data.priceReduced === true &&
        existing.priceReducedAt &&
        parsed.data.priceDiscountPercent !== undefined &&
        parsed.data.priceDiscountPercent !== existing.priceDiscountPercent
          ? priceReducedOnData(session.userId, parsed.data.priceDiscountPercent)
          : {}),
        ...(parsed.data.priceReduced === false
          ? priceReducedOffData()
          : {}),
      },
      include: inventoryEntryInclude,
    });

    if (
      parsed.data.imagePath !== undefined &&
      existing.imagePath &&
      existing.imagePath !== entry.imagePath
    ) {
      await deleteLocalUpload(existing.imagePath);
    }

    if (
      parsed.data.imagePath !== undefined &&
      !isAdhocBarcode(existing.barcode)
    ) {
      // Shared catalog products: keep the product photo in sync so cart,
      // favourites, and other batches see the same image. Local (NB…)
      // products stay entry-only so they never pad the global catalog.
      const nextProductImagePath = parsed.data.imagePath?.trim() || null;
      const product = await db.product.update({
        where: { id: existing.productId },
        data: { imagePath: nextProductImagePath },
      });
      entry.product.imagePath = product.imagePath;

      if (
        existing.product.imagePath &&
        existing.product.imagePath !== product.imagePath
      ) {
        await deleteLocalUpload(existing.product.imagePath);
      }
    }

    if (
      parsed.data.quantity !== undefined ||
      parsed.data.expiryDate !== undefined
    ) {
      await logAuditEvent(
        request,
        session,
        "inventory_updated",
        auditInventoryUpdated({
          productName: existing.product.name,
          barcode: existing.barcode,
          storeName: store.name,
          beforeQty: existing.quantity,
          afterQty: entry.quantity,
          beforeExpiry: existing.expiryDate,
          afterExpiry: entry.expiryDate,
        }),
      );
    }

    if (
      parsed.data.priceReduced === true &&
      !existing.priceReducedAt &&
      entry.priceReducedAt
    ) {
      await logAuditEvent(
        request,
        session,
        "inventory_price_reduced",
        auditInventoryPriceReduced({
          productName: existing.product.name,
          barcode: existing.barcode,
          quantity: entry.quantity,
          storeName: store.name,
          expiryDate: entry.expiryDate,
          discountPercent: entry.priceDiscountPercent ?? undefined,
        }),
      );
    } else if (
      parsed.data.priceReduced === true &&
      existing.priceReducedAt &&
      entry.priceDiscountPercent !== existing.priceDiscountPercent
    ) {
      await logAuditEvent(
        request,
        session,
        "inventory_price_reduced",
        auditInventoryPriceReduced({
          productName: existing.product.name,
          barcode: existing.barcode,
          quantity: entry.quantity,
          storeName: store.name,
          expiryDate: entry.expiryDate,
          discountPercent: entry.priceDiscountPercent ?? undefined,
        }),
      );
    } else if (
      parsed.data.priceReduced === false &&
      existing.priceReducedAt &&
      !entry.priceReducedAt
    ) {
      await logAuditEvent(
        request,
        session,
        "inventory_price_restored",
        auditInventoryPriceRestored({
          productName: existing.product.name,
          barcode: existing.barcode,
          quantity: entry.quantity,
          storeName: store.name,
          expiryDate: entry.expiryDate,
        }),
      );
    }

    return NextResponse.json({ entry });
  }

  const removed = await db.inventoryEntry.findFirst({
    where: {
      id: parsed.data.entryId,
      storeId: parsed.data.storeId,
      ...activeInventoryWhere,
    },
    include: inventoryEntryInclude,
  });

  if (!removed) {
    return NextResponse.json(
      { error: apiT(request, "errors.entryNotFound") },
      { status: 404 },
    );
  }

  // No-barcode items are local scaffolding — hard-delete so the synthetic
  // Product row can be garbage-collected instead of bloating the catalog.
  if (isAdhocBarcode(removed.barcode)) {
    await db.inventoryEntry.delete({ where: { id: removed.id } });
    if (removed.imagePath) {
      await deleteLocalUpload(removed.imagePath);
    }
    await deleteLocalProductIfUnused(removed.productId);
  } else {
    await db.inventoryEntry.update({
      where: { id: removed.id },
      data: { removedAt: new Date() },
    });
    if (removed.imagePath) {
      await deleteLocalUpload(removed.imagePath);
    }
  }

  await logAuditEvent(
    request,
    session,
    "inventory_removed",
    auditInventoryRemoved({
      productName: removed.product.name,
      barcode: removed.barcode,
      quantity: removed.quantity,
      storeName: store.name,
      expiryDate: removed.expiryDate,
    }),
  );

  return NextResponse.json({ ok: true });
}

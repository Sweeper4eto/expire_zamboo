import { NextResponse } from "next/server";
import { z } from "zod";
import {
  auditBuyListRemoved,
  auditInventoryAdded,
  auditInventoryMerged,
} from "@/lib/audit-details";
import { logAuditEvent } from "@/lib/audit-log";
import { requireSession } from "@/lib/auth";
import { activeBuyListWhere } from "@/lib/buy-list";
import { userCanAccessHomeStore } from "@/lib/home-user";
import {
  activeInventoryWhere,
  expiryDateDayBounds,
  normalizeExpiryDate,
} from "@/lib/inventory";
import { isAdhocBarcode } from "@/lib/inventory-entry-display";
import { db } from "@/lib/db";
import { apiT } from "@/i18n";

const schema = z.object({
  storeId: z.string().min(1),
  entryId: z.string().min(1),
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
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: apiT(request, "errors.invalidData") },
      { status: 400 },
    );
  }

  const store = await userCanAccessHomeStore(
    session.userId,
    parsed.data.storeId,
  );
  if (!store) {
    return NextResponse.json(
      { error: apiT(request, "errors.homeUserRequired") },
      { status: 403 },
    );
  }

  const orderEntry = await db.buyListEntry.findFirst({
    where: {
      id: parsed.data.entryId,
      storeId: parsed.data.storeId,
      ...activeBuyListWhere,
    },
    include: { product: true },
  });
  if (!orderEntry) {
    return NextResponse.json(
      { error: apiT(request, "errors.entryNotFound") },
      { status: 404 },
    );
  }

  const expiryDate = normalizeExpiryDate(new Date(parsed.data.expiryDate));
  const { start, end } = expiryDateDayBounds(expiryDate);

  const existing = await db.inventoryEntry.findFirst({
    where: {
      storeId: parsed.data.storeId,
      productId: orderEntry.productId,
      ...activeInventoryWhere,
      expiryDate: { gte: start, lt: end },
    },
    orderBy: { enteredAt: "asc" },
  });

  const result = await db.$transaction(async (tx) => {
    // Hard-delete when moving: soft-removed cart rows would keep local (NB…)
    // products alive forever and bloat the Product table.
    if (isAdhocBarcode(orderEntry.barcode)) {
      await tx.buyListEntry.delete({ where: { id: orderEntry.id } });
    } else {
      await tx.buyListEntry.update({
        where: { id: orderEntry.id },
        data: { removedAt: new Date() },
      });
    }

    if (existing) {
      const entry = await tx.inventoryEntry.update({
        where: { id: existing.id },
        data: { quantity: existing.quantity + orderEntry.quantity },
        include: { product: true },
      });
      return { entry, merged: true as const };
    }

    const entry = await tx.inventoryEntry.create({
      data: {
        storeId: parsed.data.storeId,
        productId: orderEntry.productId,
        barcode: orderEntry.barcode,
        quantity: orderEntry.quantity,
        expiryDate,
        imagePath: orderEntry.product.imagePath,
        addedByUserId: session.userId,
      },
      include: { product: true },
    });
    return { entry, merged: false as const };
  });

  await logAuditEvent(
    request,
    session,
    "buy_list_removed",
    auditBuyListRemoved({
      productName: orderEntry.product.name,
      barcode: orderEntry.barcode,
      quantity: orderEntry.quantity,
      storeName: store.name,
    }),
  );

  if (result.merged) {
    await logAuditEvent(
      request,
      session,
      "inventory_merged",
      auditInventoryMerged({
        productName: orderEntry.product.name,
        barcode: orderEntry.barcode,
        addedQty: orderEntry.quantity,
        totalQty: result.entry.quantity,
        storeName: store.name,
        expiryDate,
      }),
    );
  } else {
    await logAuditEvent(
      request,
      session,
      "inventory_added",
      auditInventoryAdded({
        productName: orderEntry.product.name,
        barcode: orderEntry.barcode,
        quantity: orderEntry.quantity,
        storeName: store.name,
        expiryDate,
      }),
    );
  }

  return NextResponse.json({
    entry: result.entry,
    merged: result.merged,
    removedOrderId: orderEntry.id,
  });
}
import { NextResponse } from "next/server";
import { z } from "zod";
import { auditInventoryRemoved } from "@/lib/audit-details";
import { logAuditEvent } from "@/lib/audit-log";
import { requireSession } from "@/lib/auth";
import { activeInventoryWhere } from "@/lib/inventory";
import { db } from "@/lib/db";
import { isAdhocBarcode } from "@/lib/inventory-entry-display";
import { deleteLocalProductIfUnused } from "@/lib/local-product";
import { userCanAccessStore } from "@/lib/store-access";
import { deleteLocalUpload } from "@/lib/upload";
import { apiT } from "@/i18n";

const MAX_BULK = 50;

const schema = z.object({
  storeId: z.string().min(1),
  entryIds: z.array(z.string().min(1)).min(1).max(MAX_BULK),
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

  const store = await userCanAccessStore(session.userId, parsed.data.storeId);
  if (!store) {
    return NextResponse.json(
      { error: apiT(request, "errors.noStoreAccess") },
      { status: 403 },
    );
  }

  const uniqueIds = [...new Set(parsed.data.entryIds)];
  const entries = await db.inventoryEntry.findMany({
    where: {
      id: { in: uniqueIds },
      storeId: store.id,
      ...activeInventoryWhere,
    },
    include: { product: true },
  });

  const foundIds = new Set(entries.map((entry) => entry.id));
  const removedIds: string[] = [];
  const skipped = uniqueIds.filter((id) => !foundIds.has(id)).length;

  for (const entry of entries) {
    if (isAdhocBarcode(entry.barcode)) {
      await db.inventoryEntry.delete({ where: { id: entry.id } });
      if (entry.imagePath) {
        await deleteLocalUpload(entry.imagePath);
      }
      await deleteLocalProductIfUnused(entry.productId);
    } else {
      await db.inventoryEntry.update({
        where: { id: entry.id },
        data: { removedAt: new Date() },
      });
      if (entry.imagePath) {
        await deleteLocalUpload(entry.imagePath);
      }
    }

    removedIds.push(entry.id);

    await logAuditEvent(
      request,
      session,
      "inventory_removed",
      auditInventoryRemoved({
        productName: entry.product.name,
        barcode: entry.barcode,
        quantity: entry.quantity,
        storeName: store.name,
        expiryDate: entry.expiryDate,
      }),
    );
  }

  return NextResponse.json({
    removed: removedIds.length,
    skipped,
    removedIds,
  });
}

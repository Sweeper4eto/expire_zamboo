import { NextResponse } from "next/server";
import { z } from "zod";
import {
  auditInventoryAdded,
  auditInventoryMerged,
} from "@/lib/audit-details";
import { logAuditEvent } from "@/lib/audit-log";
import { requireSession } from "@/lib/auth";
import { barcodeLookupValues, normalizeBarcode } from "@/lib/barcode";
import { db } from "@/lib/db";
import { userCanAccessRetailStore } from "@/lib/store-access";
import { makeAdhocBarcode } from "@/lib/inventory-entry-display";
import {
  activeInventoryWhere,
  expiryDateDayBounds,
  expiryYmdToIso,
  normalizeExpiryDate,
} from "@/lib/inventory";
import { apiT } from "@/i18n";

/** Large multi-page deliveries can take a while (one DB pass per row). */
export const maxDuration = 300;

const itemSchema = z.object({
  name: z.string().optional().nullable(),
  barcode: z.string().optional().nullable(),
  articul: z.string().optional().nullable(),
  expiryYmd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  quantity: z.number().int().positive(),
  productId: z.string().optional().nullable(),
});

const importSchema = z.object({
  storeId: z.string().min(1),
  items: z.array(itemSchema).min(1),
});

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: unknown }).code === "P2002"
  );
}

async function findProductByBarcode(barcode: string) {
  return db.product.findFirst({
    where: { barcode: { in: barcodeLookupValues(barcode) } },
  });
}

/** Create product, or reuse the existing row when barcode already exists (race / duplicates). */
async function findOrCreateImportProduct(input: {
  productId: string | null | undefined;
  barcode: string | null;
  name: string;
}) {
  let product = input.productId
    ? await db.product.findUnique({ where: { id: input.productId } })
    : null;

  if (product && input.barcode) {
    const ok = barcodeLookupValues(input.barcode).includes(product.barcode);
    if (!ok) product = null;
  }

  if (!product && input.barcode) {
    product = await findProductByBarcode(input.barcode);
  }

  if (!product) {
    const createBarcode = input.barcode || makeAdhocBarcode();
    try {
      product = await db.product.create({
        data: {
          barcode: createBarcode,
          name: input.name,
          imagePath: null,
        },
      });
    } catch (error) {
      if (!isUniqueConstraintError(error)) throw error;
      // Concurrent import / duplicate barcode in the same batch — load winner.
      product = input.barcode
        ? await findProductByBarcode(input.barcode)
        : await db.product.findUnique({ where: { barcode: createBarcode } });
      if (!product && !input.barcode) {
        product = await db.product.create({
          data: {
            barcode: makeAdhocBarcode(),
            name: input.name,
            imagePath: null,
          },
        });
      }
      if (!product) throw error;
    }
  } else if (input.name && input.name !== product.name) {
    // Reviewer may have corrected a stale catalog name — persist for future scans.
    product = await db.product.update({
      where: { id: product.id },
      data: { name: input.name },
    });
  }

  return product;
}

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
  const parsed = importSchema.safeParse(json);
  if (!parsed.success) {
    const itemCount = Array.isArray((json as { items?: unknown } | null)?.items)
      ? (json as { items: unknown[] }).items.length
      : null;
    console.error("document import validation failed", {
      itemCount,
      issues: parsed.error.issues.slice(0, 20),
    });
    return NextResponse.json(
      { error: apiT(request, "errors.documentImportInvalidRows") },
      { status: 400 },
    );
  }

  const store = await userCanAccessRetailStore(session.userId, parsed.data.storeId);
  if (!store) {
    return NextResponse.json(
      { error: apiT(request, "errors.noStoreAccess") },
      { status: 403 },
    );
  }

  try {
    let created = 0;
    let merged = 0;

    for (const item of parsed.data.items) {
      const articul = item.articul?.trim() || null;
      const name = item.name?.trim() ?? "";
      const barcode = normalizeBarcode(item.barcode ?? "") || null;
      const expiryDate = normalizeExpiryDate(
        new Date(expiryYmdToIso(item.expiryYmd)),
      );
      const { start, end } = expiryDateDayBounds(expiryDate);

      const product = await findOrCreateImportProduct({
        productId: item.productId,
        barcode,
        name,
      });

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
            quantity: existing.quantity + item.quantity,
            ...(articul ? { articul } : {}),
          },
          include: { product: true },
        });
        merged += 1;
        await logAuditEvent(
          request,
          session,
          "inventory_merged",
          auditInventoryMerged({
            productName: entry.product.name,
            barcode: entry.barcode,
            addedQty: item.quantity,
            totalQty: entry.quantity,
            storeName: store.name,
            expiryDate,
          }),
        );
        continue;
      }

      const entry = await db.inventoryEntry.create({
        data: {
          storeId: parsed.data.storeId,
          productId: product.id,
          barcode: product.barcode,
          articul,
          imagePath: null,
          quantity: item.quantity,
          expiryDate,
          addedByUserId: session.userId,
        },
        include: { product: true },
      });
      created += 1;
      await logAuditEvent(
        request,
        session,
        "inventory_added",
        auditInventoryAdded({
          productName: entry.product.name,
          barcode: entry.barcode,
          quantity: item.quantity,
          storeName: store.name,
          expiryDate,
        }),
      );
    }

    return NextResponse.json({ created, merged, total: created + merged });
  } catch (error) {
    console.error("document import failed", error);
    return NextResponse.json(
      { error: apiT(request, "errors.saveFailed") },
      { status: 500 },
    );
  }
}

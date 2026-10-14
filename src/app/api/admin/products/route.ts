import { NextResponse } from "next/server";
import { z } from "zod";
import {
  auditProductDeleted,
  auditProductUpdated,
} from "@/lib/audit-details";
import { logAuditEvent } from "@/lib/audit-log";
import { requireAdmin } from "@/lib/auth";
import { searchAdminProducts } from "@/lib/admin-product-search";
import { barcodeLookupValues, normalizeBarcode } from "@/lib/barcode";
import { db } from "@/lib/db";
import { deleteLocalUpload } from "@/lib/upload";
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
  const id = searchParams.get("id")?.trim();

  // Single-product meta (inventory count) for the edit pane.
  if (id) {
    const product = await db.product.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        barcode: true,
        imagePath: true,
        _count: { select: { inventory: true } },
      },
    });
    if (!product) {
      return NextResponse.json(
        { error: apiT(request, "errors.productNotFound") },
        { status: 404 },
      );
    }
    return NextResponse.json({ product });
  }

  const q = searchParams.get("q")?.trim();
  const page = Math.max(1, Number.parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const pageSize = Math.min(
    50,
    Math.max(1, Number.parseInt(searchParams.get("pageSize") ?? "20", 10) || 20),
  );

  const { products, hasMore } = await searchAdminProducts(q, page, pageSize);

  return NextResponse.json({
    products,
    page,
    pageSize,
    hasMore,
  });
}

const patchSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).optional(),
  barcode: z.string().min(1).optional(),
  imagePath: z.string().nullable().optional(),
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

  const updateData = { ...data };
  if (updateData.barcode !== undefined) {
    const barcode = normalizeBarcode(updateData.barcode);
    if (!barcode) {
      return NextResponse.json(
        { error: apiT(request, "errors.invalidData") },
        { status: 400 },
      );
    }
    updateData.barcode = barcode;
  }

  if (updateData.barcode) {
    const existing = await db.product.findFirst({
      where: {
        barcode: { in: barcodeLookupValues(updateData.barcode) },
        NOT: { id },
      },
    });
    if (existing) {
      return NextResponse.json(
        { error: apiT(request, "errors.productExists") },
        { status: 409 },
      );
    }
  }

  const before = await db.product.findUnique({ where: { id } });
  if (!before) {
    return NextResponse.json(
      { error: apiT(request, "errors.productNotFound") },
      { status: 404 },
    );
  }

  const barcodeChanged =
    updateData.barcode !== undefined && updateData.barcode !== before.barcode;

  let inventoryBarcodeUpdates = 0;

  const product = await db.$transaction(async (tx) => {
    const updated = await tx.product.update({ where: { id }, data: updateData });

    if (barcodeChanged) {
      const result = await tx.inventoryEntry.updateMany({
        where: { productId: id },
        data: { barcode: updated.barcode },
      });
      inventoryBarcodeUpdates = result.count;
    }

    return updated;
  });

  if (
    updateData.imagePath !== undefined &&
    before.imagePath &&
    before.imagePath !== product.imagePath
  ) {
    await deleteLocalUpload(before.imagePath);
  }

  await logAuditEvent(
    request,
    admin,
    "product_updated",
    auditProductUpdated(before, product, inventoryBarcodeUpdates),
  );

  return NextResponse.json({ product });
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

  const product = await db.product.findUnique({
    where: { id },
    include: {
      _count: { select: { inventory: true, buyList: true } },
    },
  });
  if (!product) {
    return NextResponse.json(
      { error: apiT(request, "errors.productNotFound") },
      { status: 404 },
    );
  }

  const removed = {
    inventoryEntries: product._count.inventory,
    buyListEntries: product._count.buyList,
  };

  await db.$transaction(async (tx) => {
    await tx.inventoryEntry.deleteMany({ where: { productId: id } });
    await tx.buyListEntry.deleteMany({ where: { productId: id } });
    await tx.product.delete({ where: { id } });
  });

  await deleteLocalUpload(product.imagePath);

  await logAuditEvent(
    request,
    admin,
    "product_deleted",
    auditProductDeleted(product, removed),
  );

  return NextResponse.json({ ok: true });
}

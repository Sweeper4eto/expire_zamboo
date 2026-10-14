import { NextResponse } from "next/server";
import { z } from "zod";
import { auditProductCreated } from "@/lib/audit-details";
import { logAuditEvent } from "@/lib/audit-log";
import { requireSession } from "@/lib/auth";
import { barcodeLookupValues, normalizeBarcode } from "@/lib/barcode";
import { db } from "@/lib/db";
import { lookupOpenFoodFactsProduct } from "@/lib/open-food-facts";
import { resolveProductImagePath } from "@/lib/product-image";
import { apiT } from "@/i18n";

const resolveSchema = z.object({
  barcode: z.string().min(1),
  /** When true, create a local product from Open Food Facts if found. */
  importExternal: z.boolean().optional().default(true),
});

/**
 * Resolve a barcode: local DB first, then Open Food Facts.
 * Optionally imports the external product and backfills a photo when missing.
 */
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
  const parsed = resolveSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: apiT(request, "errors.invalidData") },
      { status: 400 },
    );
  }

  const barcode = normalizeBarcode(parsed.data.barcode);
  if (!barcode) {
    return NextResponse.json(
      { error: apiT(request, "errors.missingBarcode") },
      { status: 400 },
    );
  }

  const local = await db.product.findFirst({
    where: {
      barcode: { in: barcodeLookupValues(barcode) },
      NOT: { barcode: { startsWith: "NB" } },
    },
  });
  if (local) {
    if (!local.imagePath?.trim()) {
      const external = await lookupOpenFoodFactsProduct(barcode);
      if (external?.imageUrl) {
        const imagePath = await resolveProductImagePath({
          remoteUrl: external.imageUrl,
          download: true,
        });
        if (imagePath) {
          const updated = await db.product.update({
            where: { id: local.id },
            data: { imagePath },
          });
          return NextResponse.json({
            status: "found",
            source: "local",
            product: updated,
          });
        }
      }
    }

    return NextResponse.json({
      status: "found",
      source: "local",
      product: local,
    });
  }

  const external = await lookupOpenFoodFactsProduct(barcode);
  if (!external) {
    return NextResponse.json({
      status: "missing",
      barcode,
    });
  }

  if (!parsed.data.importExternal) {
    return NextResponse.json({
      status: "suggestion",
      barcode,
      suggestion: external,
    });
  }

  const existingRace = await db.product.findFirst({
    where: { barcode: { in: barcodeLookupValues(barcode) } },
  });
  if (existingRace) {
    return NextResponse.json({
      status: "found",
      source: "local",
      product: existingRace,
    });
  }

  const imagePath = await resolveProductImagePath({
    remoteUrl: external.imageUrl,
    download: true,
  });

  const product = await db.product.create({
    data: {
      barcode,
      name: external.name,
      imagePath,
    },
  });
  await logAuditEvent(
    request,
    session,
    "product_created",
    auditProductCreated(product),
  );

  return NextResponse.json(
    {
      status: "found",
      source: "openfoodfacts",
      product,
    },
    { status: 201 },
  );
}

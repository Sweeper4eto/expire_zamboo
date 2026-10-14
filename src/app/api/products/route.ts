import { NextResponse } from "next/server";
import { z } from "zod";
import {
  auditProductCreated,
} from "@/lib/audit-details";
import { logAuditEvent } from "@/lib/audit-log";
import { requireSession } from "@/lib/auth";
import { barcodeLookupValues, normalizeBarcode } from "@/lib/barcode";
import { db } from "@/lib/db";
import { apiT } from "@/i18n";

export async function GET(request: Request) {
  try {
    await requireSession();
  } catch {
    return NextResponse.json(
      { error: apiT(request, "errors.unauthorized") },
      { status: 401 },
    );
  }

  const { searchParams } = new URL(request.url);
  const barcode = normalizeBarcode(searchParams.get("barcode") ?? "");
  if (!barcode) {
    return NextResponse.json(
      { error: apiT(request, "errors.missingBarcode") },
      { status: 400 },
    );
  }

  const product = await db.product.findFirst({
    where: { barcode: { in: barcodeLookupValues(barcode) } },
  });
  return NextResponse.json({ product });
}

const createSchema = z.object({
  barcode: z.string().min(1),
  name: z.string().min(1),
  imagePath: z.string().optional(),
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

  const barcode = normalizeBarcode(parsed.data.barcode);
  if (!barcode) {
    return NextResponse.json(
      { error: apiT(request, "errors.invalidData") },
      { status: 400 },
    );
  }

  const existing = await db.product.findFirst({
    where: { barcode: { in: barcodeLookupValues(barcode) } },
  });
  if (existing) {
    return NextResponse.json(
      { error: apiT(request, "errors.productExists"), product: existing },
      { status: 409 },
    );
  }

  const product = await db.product.create({
    data: { ...parsed.data, barcode },
  });
  await logAuditEvent(
    request,
    session,
    "product_created",
    auditProductCreated(product),
  );
  return NextResponse.json({ product }, { status: 201 });
}

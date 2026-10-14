import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { userCanAccessHomeStore } from "@/lib/home-user";
import { db } from "@/lib/db";
import { deleteLocalProductIfUnused } from "@/lib/local-product";
import { apiT } from "@/i18n";

const mutateSchema = z.object({
  storeId: z.string().min(1),
  productId: z.string().min(1),
});

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

  const favourites = await db.favouriteProduct.findMany({
    where: { storeId },
    orderBy: { createdAt: "desc" },
    include: {
      product: {
        select: { id: true, name: true, barcode: true, imagePath: true },
      },
    },
  });

  return NextResponse.json({
    favourites,
    productIds: favourites.map((item) => item.productId),
  });
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
  const parsed = mutateSchema.safeParse(json);
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

  const product = await db.product.findUnique({
    where: { id: parsed.data.productId },
    select: { id: true, name: true, barcode: true, imagePath: true },
  });
  if (!product) {
    return NextResponse.json(
      { error: apiT(request, "errors.productNotFound") },
      { status: 404 },
    );
  }

  const favourite = await db.favouriteProduct.upsert({
    where: {
      storeId_productId: {
        storeId: parsed.data.storeId,
        productId: parsed.data.productId,
      },
    },
    create: {
      storeId: parsed.data.storeId,
      productId: parsed.data.productId,
    },
    update: {},
    include: {
      product: {
        select: { id: true, name: true, barcode: true, imagePath: true },
      },
    },
  });

  return NextResponse.json({ favourite }, { status: 201 });
}

export async function DELETE(request: Request) {
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
  const parsed = mutateSchema.safeParse(json);
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

  await db.favouriteProduct.deleteMany({
    where: {
      storeId: parsed.data.storeId,
      productId: parsed.data.productId,
    },
  });

  // Local (NB…) products: keep while favourited; purge only when also gone
  // from expiry and cart.
  await deleteLocalProductIfUnused(parsed.data.productId);

  return NextResponse.json({ ok: true });
}
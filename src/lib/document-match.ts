import { Prisma } from "@/generated/prisma/client";
import { barcodeLookupValues, normalizeBarcode } from "@/lib/barcode";
import { db } from "@/lib/db";
import type { DocumentOcrRow } from "@/lib/document-ai";
import {
  activeInventoryWhere,
  expiryYmdToIso,
  normalizeExpiryDate,
} from "@/lib/inventory";
import { namesMatchForMerge } from "@/lib/product-name-match";

export type MatchedProduct = {
  id: string;
  name: string;
  imagePath: string | null;
  barcode: string;
};

export type DocumentDraftItem = {
  name: string;
  barcode: string | null;
  articul: string | null;
  expiryYmd: string | null;
  quantity: number;
  productId: string | null;
  productImagePath: string | null;
  matchSource: "barcode" | "name" | "articul" | null;
  zambooGid?: string | null;
  zambooName?: string | null;
  zambooCode?: string | null;
  zambooMatch?: "barcode" | "code" | "name" | "ai" | "fuzzy" | null;
  zambooConfidence?: "high" | "medium" | "low" | null;
};

type ProductSelect = MatchedProduct;

function draftFromRow(
  row: DocumentOcrRow,
  product: MatchedProduct | null,
  matchSource: DocumentDraftItem["matchSource"],
): DocumentDraftItem {
  return {
    name: product?.name || row.name,
    barcode:
      product?.barcode ||
      (row.barcode ? normalizeBarcode(row.barcode) || row.barcode : null),
    articul: row.articul,
    expiryYmd: row.expiryYmd,
    quantity: row.quantity,
    productId: product?.id ?? null,
    productImagePath: product?.imagePath ?? null,
    matchSource,
  };
}

async function loadProductsByBarcodes(
  barcodes: string[],
): Promise<Map<string, ProductSelect>> {
  const lookup = new Map<string, ProductSelect>();
  if (barcodes.length === 0) return lookup;

  const products = await db.product.findMany({
    where: { barcode: { in: barcodes } },
    select: { id: true, name: true, imagePath: true, barcode: true },
  });

  for (const product of products) {
    for (const value of barcodeLookupValues(product.barcode)) {
      if (!lookup.has(value)) lookup.set(value, product);
    }
  }
  return lookup;
}

type ArticulCandidate = {
  expiryDate: Date;
  product: ProductSelect;
};

/**
 * OCR sometimes drops a leading "9" on store SKUs that start with zeros
 * (e.g. printed/stored `900001197` read as `00001197`). When the raw SKU
 * starts with `0000`, also try a `9`-prefixed twin for lookup only.
 */
export function articulLookupKeys(articul: string): string[] {
  const key = articul.trim();
  if (!key) return [];
  if (/^0000\d+$/.test(key)) return [key, `9${key}`];
  return [key];
}

async function loadProductsByArticuls(
  storeId: string,
  articuls: string[],
): Promise<Map<string, ArticulCandidate[]>> {
  const lookup = new Map<string, ArticulCandidate[]>();
  if (articuls.length === 0) return lookup;

  const entries = await db.inventoryEntry.findMany({
    where: {
      storeId,
      articul: { in: articuls },
      ...activeInventoryWhere,
    },
    orderBy: { enteredAt: "desc" },
    include: {
      product: {
        select: { id: true, name: true, imagePath: true, barcode: true },
      },
    },
  });

  for (const entry of entries) {
    const key = entry.articul?.trim();
    if (!key || !entry.product) continue;
    const list = lookup.get(key) ?? [];
    list.push({ expiryDate: entry.expiryDate, product: entry.product });
    lookup.set(key, list);
  }
  return lookup;
}

function rowExpiryTimestamp(row: DocumentOcrRow): number | null {
  if (!row.expiryYmd) return null;
  try {
    return normalizeExpiryDate(new Date(expiryYmdToIso(row.expiryYmd))).getTime();
  } catch {
    return null;
  }
}

/**
 * SKU is only trusted to resolve product identity when corroborated by BOTH
 * an exact expiry-day match and a near-identical name (punctuation/symbol
 * differences only — e.g. "Ябълка , 10 % сайдер" vs "Ябълка 10 Сайдер"; a
 * real word/number difference like "5 %" vs "10 %" never matches). A bare
 * SKU match is not enough on its own, since store-internal SKUs get
 * reused/reassigned to genuinely different products over time.
 */
function findArticulMatch(
  row: DocumentOcrRow,
  byArticul: Map<string, ArticulCandidate[]>,
): ProductSelect | null {
  if (!row.articul || !row.name) return null;

  const rowExpiry = rowExpiryTimestamp(row);
  if (rowExpiry === null) return null;

  for (const key of articulLookupKeys(row.articul)) {
    const candidates = byArticul.get(key);
    if (!candidates || candidates.length === 0) continue;
    for (const candidate of candidates) {
      if (normalizeExpiryDate(candidate.expiryDate).getTime() !== rowExpiry) {
        continue;
      }
      if (!namesMatchForMerge(row.name, candidate.product.name)) continue;
      return candidate.product;
    }
  }
  return null;
}

async function loadProductsByNames(
  names: string[],
): Promise<Map<string, ProductSelect>> {
  const lookup = new Map<string, ProductSelect>();
  if (names.length === 0) return lookup;

  const products = await db.$queryRaw<ProductSelect[]>`
    SELECT id, name, imagePath, barcode
    FROM Product
    WHERE lower(name) IN (${Prisma.join(names.map((n) => n.toLowerCase()))})
  `;

  for (const product of products) {
    const key = product.name.trim().toLowerCase();
    if (!lookup.has(key)) lookup.set(key, product);
  }
  return lookup;
}

/**
 * Logs when a SKU was previously linked to a product other than the one this
 * row resolved to. Purely informational — never changes the outcome — so
 * discrepancies caused by reused/reassigned store SKUs are still visible.
 */
function crosscheckArticul(
  row: DocumentOcrRow,
  byArticul: Map<string, ArticulCandidate[]>,
  resolved: ProductSelect | null,
) {
  if (!row.articul) return;
  const candidates = articulLookupKeys(row.articul).flatMap(
    (key) => byArticul.get(key) ?? [],
  );
  if (candidates.length === 0) return;
  const other = candidates.find(
    (candidate) => !resolved || candidate.product.id !== resolved.id,
  );
  if (!other) return;
  console.warn(
    `document match crosscheck: SKU "${row.articul}" was previously linked to ` +
      `"${other.product.name}" (${other.product.id}) but this row resolved to ` +
      `${resolved ? `"${resolved.name}" (${resolved.id})` : "no catalog match"}.`,
  );
}

function resolveRow(
  row: DocumentOcrRow,
  byBarcode: Map<string, ProductSelect>,
  byArticul: Map<string, ArticulCandidate[]>,
  byName: Map<string, ProductSelect>,
): DocumentDraftItem {
  let product: ProductSelect | null = null;
  let matchSource: DocumentDraftItem["matchSource"] = null;

  if (row.barcode) {
    for (const value of barcodeLookupValues(row.barcode)) {
      const hit = byBarcode.get(value);
      if (hit) {
        product = hit;
        matchSource = "barcode";
        break;
      }
    }
  }

  if (!product && row.name) {
    const hit = byName.get(row.name.trim().toLowerCase());
    if (hit) {
      product = hit;
      matchSource = "name";
    }
  }

  if (!product) {
    const hit = findArticulMatch(row, byArticul);
    if (hit) {
      product = hit;
      matchSource = "articul";
    }
  }

  crosscheckArticul(row, byArticul, product);

  return draftFromRow(row, product, matchSource);
}

/** Match one OCR row (uses the batched path under the hood). */
export async function matchDocumentRow(
  storeId: string,
  row: DocumentOcrRow,
): Promise<DocumentDraftItem> {
  const [item] = await matchDocumentRows(storeId, [row]);
  return item;
}

/**
 * Match many OCR rows with a few batch queries instead of N sequential
 * lookups (each of which previously scanned Product for lower(name)).
 */
export async function matchDocumentRows(
  storeId: string,
  rows: DocumentOcrRow[],
): Promise<DocumentDraftItem[]> {
  if (rows.length === 0) return [];

  const barcodeValues = new Set<string>();
  const articuls = new Set<string>();
  const names = new Set<string>();

  for (const row of rows) {
    if (row.barcode) {
      for (const value of barcodeLookupValues(row.barcode)) {
        barcodeValues.add(value);
      }
    }
    const articul = row.articul?.trim();
    if (articul) {
      for (const key of articulLookupKeys(articul)) articuls.add(key);
    }
    const name = row.name?.trim();
    if (name) names.add(name);
  }

  const [byBarcode, byArticul, byName] = await Promise.all([
    loadProductsByBarcodes([...barcodeValues]),
    loadProductsByArticuls(storeId, [...articuls]),
    loadProductsByNames([...names]),
  ]);

  return rows.map((row) => resolveRow(row, byBarcode, byArticul, byName));
}

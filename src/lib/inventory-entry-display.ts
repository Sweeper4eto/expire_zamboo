/**
 * Catalog rule:
 * - Scanned or handwritten barcodes → shared global Product catalog.
 * - No barcode (picture-only / name-only) → system `NB…` barcode; local only.
 *   Never listed in admin catalog. Deleted only when not in expiry, not in
 *   cart, and not in favourites.
 */
export function makeAdhocBarcode(): string {
  return `NB${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`.toUpperCase();
}

/** True for system-generated barcodes — not part of the global catalog. */
export function isAdhocBarcode(barcode: string | null | undefined): boolean {
  return Boolean(barcode && /^NB[A-Z0-9]+$/i.test(barcode));
}

/** Prefer entry photo, then catalog photo. */
export function resolveEntryImagePath(
  entryImagePath: string | null | undefined,
  productImagePath: string | null | undefined,
): string | null {
  const entry = entryImagePath?.trim();
  if (entry) return entry;
  const product = productImagePath?.trim();
  if (product) return product;
  return null;
}
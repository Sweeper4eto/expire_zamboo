/** Start of UTC calendar day for consistent expiry matching and storage. */
export function normalizeExpiryDate(date: Date): Date {
  const normalized = new Date(date);
  normalized.setUTCHours(0, 0, 0, 0);
  return normalized;
}

/** Inclusive start and exclusive end for matching entries on the same expiry day. */
export function expiryDateDayBounds(date: Date): { start: Date; end: Date } {
  const start = normalizeExpiryDate(date);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
}

export const activeInventoryWhere = {
  removedAt: null,
  deletedAt: null,
} as const;

/** Prisma include for inventory API/list payloads. */
export const inventoryEntryInclude = {
  product: true,
  priceReducedByUser: { select: { id: true, username: true } },
  addedByUser: { select: { id: true, username: true } },
} as const;

/** Last-editor semantics: who + when whenever discount is set or changed. */
export function priceReducedOnData(userId: string, discountPercent: number) {
  return {
    priceReducedAt: new Date(),
    priceDiscountPercent: discountPercent,
    priceReducedByUserId: userId,
  };
}

export function priceReducedOffData() {
  return {
    priceReducedAt: null,
    priceDiscountPercent: null,
    priceReducedByUserId: null,
  };
}

/** UTC calendar day as YYYY-MM-DD from stored expiry ISO. */
export function expiryIsoToYmd(iso: string): string {
  const date = new Date(iso);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** ISO datetime at UTC midnight for API storage from YYYY-MM-DD. */
export function expiryYmdToIso(ymd: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!match) {
    throw new Error("Invalid expiry date");
  }
  const date = new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])),
  );
  return normalizeExpiryDate(date).toISOString();
}

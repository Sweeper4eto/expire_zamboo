import { barcodeLookupValues, normalizeBarcode } from "@/lib/barcode";

export type InventorySearchEntry = {
  barcode: string;
  articul?: string | null;
  product: { name: string };
  /** ISO date or datetime — matched when the query looks like a date. */
  expiryDate?: string | Date | null;
  /** ISO datetime — matched when the query looks like a date. */
  enteredAt?: string | Date | null;
};

export type DateSearchParts = {
  y?: number;
  m?: number;
  d?: number;
};

export function normalizeInventorySearchQuery(query: string): string {
  return query.trim().toLowerCase();
}

/** Unify 25/09/2026, 25-09-2026, 25.09.2026 → 25.09.2026 */
function normalizeDateNeedle(query: string): string {
  return query
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[/\-]/g, ".")
    .replace(/\.+$/g, "");
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * Parse a user date query into year/month/day parts.
 * Supports BG dots, EN slashes, ISO, and partials (day, day+month, month+year, year).
 */
export function parseInventoryDateQuery(query: string): DateSearchParts | null {
  const n = normalizeDateNeedle(query);
  if (!n) return null;

  let match = /^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/.exec(n);
  if (match) {
    let y = Number(match[3]);
    if (y < 100) y += 2000;
    const d = Number(match[1]);
    const m = Number(match[2]);
    if (d < 1 || d > 31 || m < 1 || m > 12) return null;
    return { d, m, y };
  }

  match = /^(\d{4})\.(\d{1,2})\.(\d{1,2})$/.exec(n);
  if (match) {
    const y = Number(match[1]);
    const m = Number(match[2]);
    const d = Number(match[3]);
    if (d < 1 || d > 31 || m < 1 || m > 12) return null;
    return { y, m, d };
  }

  match = /^(\d{1,2})\.(\d{1,2})$/.exec(n);
  if (match) {
    const d = Number(match[1]);
    const m = Number(match[2]);
    if (d < 1 || d > 31 || m < 1 || m > 12) return null;
    return { d, m };
  }

  match = /^(\d{1,2})\.(\d{4})$/.exec(n);
  if (match) {
    const m = Number(match[1]);
    const y = Number(match[2]);
    if (m < 1 || m > 12) return null;
    return { m, y };
  }

  match = /^(\d{4})\.(\d{1,2})$/.exec(n);
  if (match) {
    const y = Number(match[1]);
    const m = Number(match[2]);
    if (m < 1 || m > 12) return null;
    return { y, m };
  }

  match = /^(\d{4})$/.exec(n);
  if (match) {
    return { y: Number(match[1]) };
  }

  // Day only: "25" / "5" — also month if 1–12 (matched as either below).
  match = /^(\d{1,2})$/.exec(n);
  if (match) {
    const num = Number(match[1]);
    if (num >= 1 && num <= 31) return { d: num };
  }

  return null;
}

function ymdFromValue(value: string | Date): { y: number; m: number; d: number } | null {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return {
      y: value.getUTCFullYear(),
      m: value.getUTCMonth() + 1,
      d: value.getUTCDate(),
    };
  }

  const raw = value.trim();
  const isoDay = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
  if (isoDay) {
    return {
      y: Number(isoDay[1]),
      m: Number(isoDay[2]),
      d: Number(isoDay[3]),
    };
  }

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  return {
    y: date.getUTCFullYear(),
    m: date.getUTCMonth() + 1,
    d: date.getUTCDate(),
  };
}

function datePartsMatch(
  ymd: { y: number; m: number; d: number },
  parts: DateSearchParts,
): boolean {
  if (parts.y != null && parts.y !== ymd.y) return false;
  if (parts.m != null && parts.m !== ymd.m) return false;
  if (parts.d != null && parts.d !== ymd.d) return false;
  return parts.y != null || parts.m != null || parts.d != null;
}

/** Bare "9" / "09" may mean day 9 or month September. */
function bareNumberMatchesDate(
  ymd: { y: number; m: number; d: number },
  query: string,
): boolean {
  const n = normalizeDateNeedle(query);
  if (!/^\d{1,2}$/.test(n)) return false;
  const num = Number(n);
  if (num >= 1 && num <= 31 && ymd.d === num) return true;
  if (num >= 1 && num <= 12 && ymd.m === num) return true;
  return false;
}

/** Common display forms so typing a prefix of what you see still matches. */
function dateHaystacks(ymd: { y: number; m: number; d: number }): string[] {
  const { y, m, d } = ymd;
  const dd = pad2(d);
  const mm = pad2(m);
  return [
    `${dd}/${mm}/${y}`,
    `${dd}.${mm}.${y}`,
    `${dd}-${mm}-${y}`,
    `${d}/${m}/${y}`,
    `${d}.${m}.${y}`,
    `${dd}/${mm}`,
    `${dd}.${mm}`,
    `${d}/${m}`,
    `${d}.${m}`,
    `${mm}/${y}`,
    `${mm}.${y}`,
    `${m}/${y}`,
    `${m}.${y}`,
    `${y}-${mm}-${dd}`,
    `${y}/${mm}/${dd}`,
    `${y}.${mm}.${dd}`,
    `${y}-${mm}`,
    `${y}`,
    dd,
    String(d),
    mm,
    String(m),
  ];
}

function matchesDateHaystack(
  ymd: { y: number; m: number; d: number },
  query: string,
): boolean {
  const n = normalizeDateNeedle(query);
  if (!n || !/\d/.test(n)) return false;
  return dateHaystacks(ymd).some((hay) => {
    const h = normalizeDateNeedle(hay);
    return h === n || h.startsWith(`${n}.`) || h.startsWith(n);
  });
}

export function matchesInventoryDateFields(
  entry: Pick<InventorySearchEntry, "expiryDate" | "enteredAt">,
  query: string,
): boolean {
  const n = normalizeDateNeedle(query);
  if (!n || !/^\d/.test(n)) return false;

  const parts = parseInventoryDateQuery(n);
  const bareOnly = /^\d{1,2}$/.test(n);

  for (const value of [entry.expiryDate, entry.enteredAt]) {
    if (value == null || value === "") continue;
    const ymd = ymdFromValue(value);
    if (!ymd) continue;

    if (bareOnly && bareNumberMatchesDate(ymd, n)) return true;
    if (!bareOnly && parts && datePartsMatch(ymd, parts)) return true;
    if (!bareOnly && matchesDateHaystack(ymd, n)) return true;
  }
  return false;
}

export function matchesInventorySearch(
  entry: InventorySearchEntry,
  query: string,
): boolean {
  const needle = normalizeInventorySearchQuery(query);
  if (!needle) return true;

  const name = entry.product.name.toLowerCase();
  const barcode = entry.barcode.toLowerCase();
  const articul = (entry.articul ?? "").toLowerCase();
  const normalizedBarcode = normalizeBarcode(query)?.toLowerCase() ?? "";

  if (name.includes(needle)) return true;
  if (articul && articul.includes(needle)) return true;

  if (barcode.includes(needle)) return true;

  if (
    normalizedBarcode &&
    barcodeLookupValues(entry.barcode).some((value) =>
      value.toLowerCase().includes(normalizedBarcode),
    )
  ) {
    return true;
  }

  const tokens = needle.split(/\s+/).filter(Boolean);
  if (tokens.length > 1 && tokens.every((token) => name.includes(token))) {
    return true;
  }

  if (matchesInventoryDateFields(entry, needle)) return true;

  return false;
}

export function filterInventoryEntriesBySearch<T extends InventorySearchEntry>(
  entries: T[],
  query: string,
): T[] {
  const needle = normalizeInventorySearchQuery(query);
  if (!needle) return entries;
  return entries.filter((entry) => matchesInventorySearch(entry, needle));
}

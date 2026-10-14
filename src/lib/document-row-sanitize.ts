import { isPlausibleBarcode, normalizeBarcode } from "@/lib/barcode";
import type { DocumentOcrRow } from "@/lib/document-ai";

export const MAX_DOCUMENT_QUANTITY = 999;

function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

export function looksLikeEan(value: string): boolean {
  const digits = digitsOnly(value);
  return /^\d{8}$|^\d{12}$|^\d{13}$/.test(digits);
}

export function isLikelyInvalidBarcode(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (!looksLikeEan(trimmed)) return false;
  return !isPlausibleBarcode(normalizeBarcode(digitsOnly(trimmed)));
}

/** Clean OCR output without moving values between barcode and articul. */
export function sanitizeDocumentRow(row: DocumentOcrRow): DocumentOcrRow {
  const { name, expiryYmd } = row;
  let { barcode, articul, quantity } = row;

  if (barcode) {
    const trimmed = barcode.trim();
    if (looksLikeEan(trimmed)) {
      barcode = normalizeBarcode(digitsOnly(trimmed));
    } else {
      barcode = trimmed;
    }
  }

  if (articul) {
    articul = articul.trim() || null;
  }

  const qty = Math.round(quantity);
  quantity = Math.min(
    Math.max(Number.isFinite(qty) ? qty : 1, 1),
    MAX_DOCUMENT_QUANTITY,
  );

  return { name, barcode, articul, expiryYmd, quantity };
}

function nameWords(name: string): string[] {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * Short name with no SKU/barcode — typical OCR leftover from a cut-off
 * page-boundary word (e.g. a single wrapped word like "Праскова").
 *
 * Do NOT treat normal short product names (e.g. "AEA KRANCH") as fragments:
 * two-word brand lines are real rows.
 */
export function isLikelyNameFragment(row: DocumentOcrRow): boolean {
  if (row.barcode || row.articul) return false;
  const name = row.name.trim();
  if (!name) return false;
  const words = nameWords(name);
  // Single orphan word only — two-word names are usually real products.
  return words.length === 1 && name.length <= 40;
}

function nameLooselyContainedIn(fragment: string, full: string): boolean {
  const left = fragment.trim().toLowerCase();
  const right = full.trim().toLowerCase();
  if (!left || !right || left === right) return false;
  if (right.includes(left)) return true;
  const fragWords = nameWords(left);
  if (fragWords.length !== 1) return false;
  return nameWords(right).some((word) => word === fragWords[0]);
}

/**
 * Drop leftover name fragments OCR invented at page edges.
 * Does not copy or clear quantity/expiry on any other row — each row keeps
 * only what OCR assigned to it.
 */
export function repairFragmentRowAlignment(
  rows: DocumentOcrRow[],
): DocumentOcrRow[] {
  if (rows.length < 2) return rows;

  const out = rows.map((row) => ({ ...row }));
  let i = 0;
  while (i < out.length - 1) {
    const current = out[i];
    if (!isLikelyNameFragment(current)) {
      i += 1;
      continue;
    }

    const next = out[i + 1];

    // Fragment word is clearly part of the next product name. If OCR parked
    // the real row's date/qty on the crumb, give those fields back.
    if (nameLooselyContainedIn(current.name, next.name)) {
      if (!next.expiryYmd && current.expiryYmd) {
        next.expiryYmd = current.expiryYmd;
      }
      if (next.quantity === 1 && current.quantity !== 1) {
        next.quantity = current.quantity;
      }
      out.splice(i, 1);
      continue;
    }

    // Short leftover sitting above a real product line — drop the crumb only.
    if (
      Boolean(next.barcode) ||
      Boolean(next.articul) ||
      nameWords(next.name).length >= 2 ||
      next.name.trim().length > current.name.trim().length
    ) {
      out.splice(i, 1);
      continue;
    }

    i += 1;
  }

  return out;
}

/**
 * Drop leftover crumbs that never got their own data — a single orphan word
 * with defaults only. Keep longer name-only rows (real products missing Godnost).
 */
export function dropOrphanNameFragments(
  rows: DocumentOcrRow[],
): DocumentOcrRow[] {
  return rows.filter((row) => {
    if (!isLikelyNameFragment(row)) return true;
    if (row.expiryYmd) return true;
    if (row.quantity !== 1) return true;
    return nameWords(row.name).length > 1;
  });
}

function endsIncompleteProductName(name: string): boolean {
  const trimmed = name.trim();
  if (!trimmed) return false;
  // Last token is a conjunction / hyphen — the printed name wraps to the next line.
  return /(?:\bи|\bй|\band|\bor|\bof|\bс|\bсъс|,|-|\/)$/i.test(trimmed);
}

function startsLikeNameContinuation(name: string): boolean {
  const trimmed = name.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith(",") || trimmed.startsWith("-")) return true;
  const first = trimmed[0];
  // Lowercase Latin/Cyrillic start = mid-phrase wrap (e.g. "сусам, 160г").
  return first === first.toLowerCase() && first !== first.toUpperCase();
}

function hasPackWeightSuffix(name: string): boolean {
  return /\d+([.,]\d+)?\s*(г|гр|g|кг|kg|мл|ml|л|l)\.?$/i.test(name.trim());
}

/**
 * True when `curr` is the second printed line of `prev`'s wrapped product name
 * (qty/Godnost usually sit on the first line; the wrap line is name-only).
 */
function namesEqualIgnoreCase(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

export function isWrappedNameContinuation(
  prev: DocumentOcrRow,
  curr: DocumentOcrRow,
): boolean {
  if (curr.barcode || curr.articul) return false;
  // Same full name twice = two real table rows (e.g. Maggi qty 21 + Maggi qty 1),
  // not a wrapped single product. Never merge those.
  if (namesEqualIgnoreCase(prev.name, curr.name)) return false;

  const currBare = !curr.expiryYmd && curr.quantity === 1;
  const wrapHint =
    endsIncompleteProductName(prev.name) ||
    startsLikeNameContinuation(curr.name) ||
    (!hasPackWeightSuffix(prev.name) &&
      hasPackWeightSuffix(curr.name) &&
      nameWords(curr.name).length <= 6);

  if (!wrapHint) return false;

  // Usual case: first line has table columns, second line is name-only.
  if (currBare) return true;

  // Less common: Godnost printed next to the wrap line; first line name-only.
  if (
    !prev.expiryYmd &&
    curr.expiryYmd &&
    !prev.barcode &&
    !prev.articul &&
    endsIncompleteProductName(prev.name)
  ) {
    return true;
  }

  return false;
}

/**
 * Merge OCR splits of one product whose name wraps across two table lines, e.g.
 *   "АЕА КРАНЦХ … зехтин и"
 *   "сусам, 160г"
 * into a single row, keeping qty/Godnost from whichever line carried them.
 */
export function mergeWrappedNameContinuations(
  rows: DocumentOcrRow[],
): DocumentOcrRow[] {
  if (rows.length < 2) return rows;

  const out: DocumentOcrRow[] = [];
  for (const row of rows) {
    const curr = { ...row };
    const prev = out[out.length - 1];
    if (prev && isWrappedNameContinuation(prev, curr)) {
      prev.name = `${prev.name.trim()} ${curr.name.trim()}`.replace(
        /\s+/g,
        " ",
      );
      if (!prev.expiryYmd && curr.expiryYmd) prev.expiryYmd = curr.expiryYmd;
      if (prev.quantity === 1 && curr.quantity !== 1) {
        prev.quantity = curr.quantity;
      }
      if (!prev.barcode && curr.barcode) prev.barcode = curr.barcode;
      if (!prev.articul && curr.articul) prev.articul = curr.articul;
      continue;
    }
    out.push(curr);
  }
  return out;
}

/** Strong product identity — used to avoid stealing a real first-row Godnost. */
function rowLooksLikeCompleteProduct(row: DocumentOcrRow): boolean {
  if (row.barcode || row.articul) return true;
  if (nameWords(row.name).length >= 4) return true;
  if (hasPackWeightSuffix(row.name)) return true;
  return false;
}

/**
 * When OCR zips the Godnost column one row too high, every name gets the
 * *next* row's date and the last row is left blank:
 *   true:  [null, D2, D3, D4]
 *   OCR:   [D2,   D3, D4, null]
 * Repair: shift dates down by one (quantities untouched).
 *
 * Kept as a helper; not applied automatically (too many false positives).
 */
export function repairUpwardExpiryColumnShift(
  rows: DocumentOcrRow[],
): DocumentOcrRow[] {
  if (rows.length < 2) return rows;
  const last = rows[rows.length - 1];
  const first = rows[0];
  if (last.expiryYmd) return rows;
  if (!first.expiryYmd) return rows;

  let dated = 0;
  for (const row of rows) {
    if (row.expiryYmd) dated += 1;
  }
  if (dated !== rows.length - 1) return rows;

  if (
    rowLooksLikeCompleteProduct(first) &&
    !rowLooksLikeCompleteProduct(last)
  ) {
    return rows;
  }

  const extracted = rows.map((row) => row.expiryYmd);
  return rows.map((row, index) => ({
    ...row,
    expiryYmd: index === 0 ? null : extracted[index - 1],
  }));
}

export function sanitizeDocumentRows(rows: DocumentOcrRow[]): DocumentOcrRow[] {
  const cleaned = rows.map(sanitizeDocumentRow);
  // Merge wrapped name lines before dropping "fragments", so
  // "… зехтин и" + "сусам, 160г" becomes one dated product.
  const mergedWraps = mergeWrappedNameContinuations(cleaned);
  const withoutFragments = repairFragmentRowAlignment(mergedWraps);
  // Do not auto-shift the Godnost column — guessing shift direction moves
  // correct dates onto the wrong products. Alignment must come from the model.
  return dropOrphanNameFragments(withoutFragments);
}

/**
 * Normalizes a product name for "is this basically the same name" checks used
 * when deciding whether to merge a scanned document row into an existing
 * catalog product.
 *
 * Keeps real word/number differences (e.g. 82 vs 92). Only ignores:
 * - punctuation / symbol noise
 * - OCR Latin/Cyrillic x↔х (and case)
 * - unit spelling after a digit: гр / г / g
 * - missing spaces around digits / units (портокал330 ↔ портокал 330)
 */

/** Fold only x / х — the main OCR twin in multipliers and brand fragments. */
function foldXh(value: string): string {
  return value.replace(/[хХ]/g, "x");
}

/**
 * Canonicalize weight unit after a digit. Do not map the whole alphabet.
 * Unicode-aware end (JS `\b` breaks on Cyrillic).
 */
function canonicalizeUnitSuffixes(value: string): string {
  return value.replace(/(\d)\s*(?:гр|г|g)(?!\p{L})/giu, "$1g");
}

/** Collapse spaces so "портокал 330мл" and "портокал330мл" match. */
function collapseDigitLetterSpaces(value: string): string {
  return value
    .replace(/(\d)\s+(\p{L})/gu, "$1$2")
    .replace(/(\p{L})\s+(\d)/gu, "$1$2");
}

export function normalizeProductNameForMatch(name: string): string {
  // Punctuation first so digit/letter space collapse sees a clean string.
  const cleaned = foldXh(name.toLowerCase())
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  return collapseDigitLetterSpaces(canonicalizeUnitSuffixes(cleaned))
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * True when two names are identical once punctuation/symbol noise and the
 * narrow OCR folds above are applied. Real word/number differences are NOT
 * a match.
 */
export function namesMatchForMerge(a: string, b: string): boolean {
  const left = normalizeProductNameForMatch(a);
  const right = normalizeProductNameForMatch(b);
  return left.length > 0 && left === right;
}

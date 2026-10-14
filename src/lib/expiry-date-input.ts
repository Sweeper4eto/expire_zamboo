/** Pure date-input helpers shared by ExpiryDatePicker (and tests). */

export function parseYmdLocal(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const date = new Date(year, month, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

export function toYmdLocal(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Accept YYYY-MM-DD or DD.MM.YYYY / DD/MM/YYYY. */
export function parseFlexibleExpiryInput(value: string): string | null {
  const raw = value.trim();
  if (!raw) return null;

  const iso = parseYmdLocal(raw);
  if (iso) return toYmdLocal(iso);

  const dmy = /^(\d{1,2})[./\-](\d{1,2})[./\-](\d{2,4})$/.exec(raw);
  if (!dmy) return null;
  const day = Number(dmy[1]);
  const month = Number(dmy[2]);
  let year = Number(dmy[3]);
  if (year < 100) year += 2000;
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return toYmdLocal(date);
}

export function formatYmdAsDmy(ymd: string): string {
  const parsed = parseYmdLocal(ymd);
  if (!parsed) return "";
  const day = String(parsed.getDate()).padStart(2, "0");
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  return `${day}.${month}.${parsed.getFullYear()}`;
}

export const DMY_MASK_TEMPLATE = "DD.MM.YYYY";

/** Digits only from a YYYY-MM-DD value (DDMMYYYY). */
export function ymdToDmyDigits(ymd: string): string {
  const formatted = formatYmdAsDmy(ymd);
  return formatted ? formatted.replace(/\D/g, "") : "";
}

/** Keep only digit characters, max 8 (DDMMYYYY). */
export function extractDmyDigits(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, 8);
}

/**
 * Fill DD.MM.YYYY — typed digits replace D/M/Y placeholders; the rest stay
 * so the user always sees what is left to enter.
 */
export function formatDmyMask(digits: string): string {
  const clean = extractDmyDigits(digits);
  const template = ["D", "D", ".", "M", "M", ".", "Y", "Y", "Y", "Y"];
  let i = 0;
  return template
    .map((slot) => (slot === "." ? "." : clean[i++] ?? slot))
    .join("");
}

/** Caret index in the masked string after `digitCount` digits. */
export function dmyMaskCaretPos(digitCount: number): number {
  const n = Math.max(0, Math.min(8, digitCount));
  if (n <= 2) return n;
  if (n <= 4) return n + 1;
  return n + 2;
}

function daysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

/**
 * Reject impossible partial/full DDMMYYYY sequences while typing.
 * Optional min/max YYYY-MM-DD clamp the completed date.
 */
export function isValidPartialDmyDigits(
  digits: string,
  minYmd?: string,
  maxYmd?: string,
): boolean {
  const clean = extractDmyDigits(digits);
  if (!clean) return true;
  if (!/^\d{1,8}$/.test(clean)) return false;

  if (clean.length === 1) {
    return clean[0] >= "0" && clean[0] <= "3";
  }

  const day = Number(clean.slice(0, 2));
  if (clean.length >= 2 && (day < 1 || day > 31)) return false;

  if (clean.length === 3) {
    return clean[2] === "0" || clean[2] === "1";
  }

  if (clean.length >= 4) {
    const month = Number(clean.slice(2, 4));
    if (month < 1 || month > 12) return false;

    const yearDigits = clean.slice(4);
    if (clean.length === 8) {
      const year = Number(yearDigits);
      if (year < 1000 || year > 9999) return false;
      if (day > daysInMonth(year, month - 1)) return false;
      const ymd = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      if (!parseYmdLocal(ymd)) return false;
      if (minYmd && ymd < minYmd) return false;
      if (maxYmd && ymd > maxYmd) return false;
      return true;
    }

    // Month known, year incomplete — use leap-safe Feb max of 29.
    const maxDay = month === 2 ? 29 : daysInMonth(2024, month - 1);
    if (day > maxDay) return false;

    if (clean.length >= 5) {
      const minYear = minYmd ? Number(minYmd.slice(0, 4)) : 1000;
      const maxYear = maxYmd ? Number(maxYmd.slice(0, 4)) : 9999;
      const prefix = yearDigits;
      let possible = false;
      for (let y = minYear; y <= maxYear; y += 1) {
        if (String(y).startsWith(prefix)) {
          possible = true;
          break;
        }
      }
      if (!possible) return false;
    }
  }

  return true;
}

/** Convert complete DDMMYYYY digits to YYYY-MM-DD, or null. */
export function dmyDigitsToYmd(digits: string): string | null {
  const clean = extractDmyDigits(digits);
  if (clean.length !== 8) return null;
  if (!isValidPartialDmyDigits(clean)) return null;
  const day = clean.slice(0, 2);
  const month = clean.slice(2, 4);
  const year = clean.slice(4, 8);
  return parseFlexibleExpiryInput(`${day}.${month}.${year}`);
}

/**
 * Accept as many leading digits from `candidate` as remain valid.
 * Used when applying paste / bulk onChange.
 */
export function acceptDmyDigits(
  candidate: string,
  minYmd?: string,
  maxYmd?: string,
): string {
  const clean = extractDmyDigits(candidate);
  let accepted = "";
  for (const ch of clean) {
    const next = accepted + ch;
    if (!isValidPartialDmyDigits(next, minYmd, maxYmd)) break;
    accepted = next;
  }
  return accepted;
}

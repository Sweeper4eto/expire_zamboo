const CYR_TO_LAT: Record<string, string> = {
  а: "a",
  б: "b",
  в: "v",
  г: "g",
  д: "d",
  е: "e",
  ж: "zh",
  з: "z",
  и: "i",
  й: "y",
  к: "k",
  л: "l",
  м: "m",
  н: "n",
  о: "o",
  п: "p",
  р: "r",
  с: "s",
  т: "t",
  у: "u",
  ф: "f",
  х: "h",
  ц: "ts",
  ч: "ch",
  ш: "sh",
  щ: "sht",
  ъ: "a",
  ь: "",
  ю: "yu",
  я: "ya",
};

const STOPWORDS = new Set([
  "i",
  "and",
  "s",
  "na",
  "ot",
  "za",
  "kg",
  "g",
  "l",
  "ml",
  "br",
  "sht",
  "ea",
  "but",
  "butelka",
  "bottle",
  "ken",
  "can",
]);

const SIZE_RE =
  /(\d+(?:[.,]\d+)?)\s*[./]?\s*(мл|ml|л|l|гр|г|g|кг|kg)(?!\p{L})/giu;

/** 8–14 digit codes that look like EAN / UPC, not store SKUs. */
export function extractBarcode(value: string | null | undefined): string | null {
  const raw = value?.trim() ?? "";
  if (!/^\d{8,14}$/.test(raw)) return null;
  return raw;
}

export function transliterateCyrillic(value: string): string {
  return value.replace(/[\u0400-\u04FF]/g, (char) => {
    const lower = char.toLowerCase();
    const mapped = CYR_TO_LAT[lower];
    if (mapped === undefined) return char;
    return mapped;
  });
}

/** Shared key for Latin OCR vs Cyrillic catalog names. */
export function normalizeZambooName(name: string): string {
  const cleaned = name
    .toLowerCase()
    .replace(/[хХ]/g, "x")
    .replace(/[^\p{L}\p{N}\s]+/gu, " ");
  const latin = transliterateCyrillic(cleaned).replace(
    /(\d)\s*(?:гр|г|g)(?!\p{L})/giu,
    "$1g",
  );
  return latin.replace(/\s+/g, " ").trim();
}

/** c/k is the usual Latin vs scientific-transliteration split (coca/koka). */
export function foldZambooToken(token: string): string {
  return token.replace(/c/g, "k");
}

function isSizeLikeToken(token: string): boolean {
  return /^\d+(?:[.,]\d+)?(?:ml|l|g|kg)?$/.test(token);
}

export function zambooNameTokens(name: string): string[] {
  const normalized = normalizeZambooName(name);
  if (!normalized) return [];
  return normalized
    .split(" ")
    .map((token) => token.trim())
    .filter(
      (token) =>
        token.length >= 2 && !STOPWORDS.has(token) && !isSizeLikeToken(token),
    );
}

function canonicalVolume(amount: number, unit: string): string | null {
  const u = unit.toLowerCase();
  if (u === "мл" || u === "ml") {
    return `${Math.round(amount)}ml`;
  }
  if (u === "л" || u === "l") {
    if (amount < 1) return `${Math.round(amount * 1000)}ml`;
    const rounded = Number(amount.toFixed(2));
    return `${rounded}l`;
  }
  if (u === "кг" || u === "kg") {
    return `${Number(amount.toFixed(3))}kg`;
  }
  if (u === "гр" || u === "г" || u === "g") {
    if (amount >= 1000) return `${Number((amount / 1000).toFixed(3))}kg`;
    return `${Math.round(amount)}g`;
  }
  return null;
}

export function extractSizes(name: string): string[] {
  const sizes = new Set<string>();
  const source = name.toLowerCase();
  for (const match of source.matchAll(SIZE_RE)) {
    const amount = Number(match[1].replace(",", "."));
    if (!Number.isFinite(amount) || amount <= 0) continue;
    const size = canonicalVolume(amount, match[2]);
    if (size) sizes.add(size);
  }
  return [...sizes];
}

export function sizesCompatible(ocrSizes: string[], catalogSizes: string[]): boolean {
  if (ocrSizes.length === 0 || catalogSizes.length === 0) return true;
  return ocrSizes.some((size) => catalogSizes.includes(size));
}

export type ZambooPack = "bottle" | "can";

/** Pack form from the printed name. Liters without бут/кен stay null. */
export function extractPack(name: string): ZambooPack | null {
  const normalized = ` ${normalizeZambooName(name)} `;
  if (/\s(ken|can)\s/.test(normalized)) return "can";
  if (/\s(but|butelka|bottle)\s/.test(normalized)) return "bottle";
  return null;
}

export function canonicalizeSizeToken(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;
  const sizes = extractSizes(value);
  if (sizes[0]) return sizes[0];
  const normalized = value.trim().toLowerCase().replace(/\s+/g, "");
  if (/^\d+(?:[.,]\d+)?(?:ml|l|g|kg)$/.test(normalized)) {
    return normalized.replace(",", ".");
  }
  return null;
}

export function canonicalizePackToken(
  value: string | null | undefined,
): ZambooPack | null {
  if (!value) return null;
  const normalized = normalizeZambooName(value);
  if (/\b(ken|can)\b/.test(normalized)) return "can";
  if (/\b(but|butelka|bottle)\b/.test(normalized)) return "bottle";
  return null;
}

export function tokenEditDistance(a: string, b: string): number {
  if (a === b) return 0;
  const rows = a.length + 1;
  const cols = b.length + 1;
  const grid = new Uint16Array(rows * cols);
  for (let i = 0; i < rows; i += 1) grid[i * cols] = i;
  for (let j = 0; j < cols; j += 1) grid[j] = j;
  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const idx = i * cols + j;
      grid[idx] = Math.min(
        grid[(i - 1) * cols + j] + 1,
        grid[i * cols + j - 1] + 1,
        grid[(i - 1) * cols + j - 1] + cost,
      );
    }
  }
  return grid[(rows - 1) * cols + (cols - 1)];
}

export function tokensMatch(a: string, b: string): boolean {
  const left = foldZambooToken(a);
  const right = foldZambooToken(b);
  if (left === right) return true;
  const longest = Math.max(left.length, right.length);
  if (longest < 4) return false;
  return tokenEditDistance(left, right) <= 1;
}

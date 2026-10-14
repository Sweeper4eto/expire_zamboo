/**
 * Normalize product display names imported from Open Food Facts / catalogs.
 */

const ENTITY_MAP: Record<string, string> = {
  quot: '"',
  amp: "&",
  lt: "<",
  gt: ">",
  apos: "'",
  nbsp: " ",
  deg: "\u00B0",
  ndash: "\u2013",
  mdash: "\u2014",
  rsquo: "'",
  lsquo: "'",
  rdquo: '"',
  ldquo: '"',
};

export function decodeHtmlEntities(value: string): string {
  let text = value;
  for (let i = 0; i < 3; i += 1) {
    const next = text.replace(
      /&(#x[0-9a-f]+|#\d+|[\w]+);/gi,
      (match, body: string) => {
        const key = body.toLowerCase();
        if (key.startsWith("#x")) {
          const code = Number.parseInt(key.slice(2), 16);
          return Number.isFinite(code) ? String.fromCodePoint(code) : match;
        }
        if (key.startsWith("#")) {
          const code = Number.parseInt(key.slice(1), 10);
          return Number.isFinite(code) ? String.fromCodePoint(code) : match;
        }
        return ENTITY_MAP[key] ?? match;
      },
    );
    if (next === text) break;
    text = next;
  }
  return text;
}

function unwrapOuterQuotes(value: string): string {
  let text = value.trim();
  for (let i = 0; i < 4; i += 1) {
    if (text.length < 2) break;
    const first = text[0];
    const last = text[text.length - 1];
    const paired =
      (first === '"' && last === '"') ||
      (first === "'" && last === "'") ||
      (first === "\u201C" && last === "\u201D") ||
      (first === "\u2018" && last === "\u2019") ||
      (first === "\u00AB" && last === "\u00BB");
    if (!paired) break;
    text = text.slice(1, -1).trim();
  }
  return text;
}

/** Clean imported catalog names for display. */
export function cleanProductName(raw: string): string {
  let text = decodeHtmlEntities(String(raw || "")).replace(/\u0000/g, "");
  text = text.replace(/['"]?Prodhead['"]?\s*(>|&gt;)\s*/gi, "");
  text = text.replace(/"+/g, '"');
  text = unwrapOuterQuotes(text);

  // Strip paired double quotes around phrases, but keep apostrophes (l'huile).
  text = text.replace(/"([^"]{1,80})"/g, "$1");

  text = text.replace(/!([^!]{1,60})!/g, "$1");
  text = text.replace(/^[\s!"#',;:_.-]+/, "");
  text = text.replace(/[\s!"#_]+$/, "");
  text = text.replace(/^\s*,\s*/, "");

  text = text.replace(/\s*,\s*,+/g, ", ");
  text = text.replace(/^,+|,+$/g, "");
  text = text.replace(/\s+/g, " ").trim();
  text = unwrapOuterQuotes(text);
  text = text.replace(/^!+\s*/, "").trim();
  text = text.replace(/^,+|,+$/g, "").trim();

  return text.slice(0, 200);
}

export function isLowQualityProductName(name: string): boolean {
  const cleaned = cleanProductName(name);
  if (!cleaned || cleaned.length < 2) return true;

  const letters = cleaned.replace(/[^\p{L}\p{N}]+/gu, "");
  if (letters.length < 2) return true;

  const commaParts = cleaned.split(",").map((p) => p.trim()).filter(Boolean);
  if (commaParts.length >= 3) {
    const short = commaParts.filter((p) => p.length <= 4).length;
    if (short >= 2) return true;
  }

  if (/\d+\s*\/\s*\d+\s*#/.test(cleaned)) return true;
  if (/\b\d+#\b/.test(cleaned) && commaParts.length >= 2) return true;

  if (
    commaParts.length >= 3 &&
    commaParts.every((p) => /^[A-Za-z0-9.#:/+-]{1,12}$/.test(p))
  ) {
    return true;
  }

  return false;
}

/**
 * Titles from free barcode sites that are usually wrong for a grocery catalog:
 * collectors, empties, Amazon SEO spam, tools, electronics, etc.
 */
export function isSuspiciousRemoteProductName(name: string): boolean {
  const cleaned = cleanProductName(name);
  if (!cleaned) return false;

  if (
    /\b(empty|unused|collectors?|collectibles?|collect|inscribed|бутылки|пляшка)\b/i.test(
      cleaned,
    )
  ) {
    return true;
  }
  if (/\buk\s*import\b|\bacc\s*new\b|\bbrand\s*new\s*in\s*box\b/i.test(cleaned)) {
    return true;
  }
  if (
    /\b(cnc|end\s*mill|mud\s*flap|capture\s*card|led\s*(tube|smd)|fluorescent|carton\s*cutter|replacement\s*blades)\b/i.test(
      cleaned,
    )
  ) {
    return true;
  }
  if (/\b(shoe\s*size|crew\s*socks|homeopathic)\b/i.test(cleaned)) {
    return true;
  }
  if (/\b(package\s*may\s*vary|see\s*below|dimensions\s*:)\b/i.test(cleaned)) {
    return true;
  }
  if (/\bcan\s+from\b/i.test(cleaned) && /\b(ml|litre|liter)\b/i.test(cleaned)) {
    return true;
  }
  if (
    /\b(new-warheads|wsf-tools|elgato|genuine\s+volkswagen)\b/i.test(
      cleaned.toLowerCase(),
    )
  ) {
    return true;
  }
  return false;
}

/** Extra marketplace/SEO noise — used when accepting live internet titles. */
export function isMarketplaceSeoProductName(name: string): boolean {
  const cleaned = cleanProductName(name);
  if (!cleaned) return true;
  if (cleaned.length > 90) return true;
  if ((cleaned.match(/,/g) || []).length >= 3) return true;
  if ((cleaned.match(/\(/g) || []).length >= 2) return true;
  if (/\bpack\s+of\s+\d+/i.test(cleaned) && cleaned.length > 55) return true;
  if (/\b\d+\s*[-–]\s*pack\b/i.test(cleaned) && cleaned.length > 55) return true;
  if (cleaned.length > 70) {
    const words = cleaned.split(/\s+/).filter(Boolean);
    if (words.length >= 12) return true;
  }
  return false;
}

/** Remote internet title safe enough to write into the catalog. */
export function isAcceptableInternetProductName(name: string): boolean {
  const cleaned = cleanProductName(name);
  if (!cleaned || cleaned.length < 3) return false;
  if (isLowQualityProductName(cleaned)) return false;
  if (isSuspiciousRemoteProductName(cleaned)) return false;
  if (isMarketplaceSeoProductName(cleaned)) return false;
  return true;
}

function scoreName(name: string): number {
  const cleaned = cleanProductName(name);
  if (!cleaned) return -1000;
  let score = Math.min(cleaned.length, 80);
  if (isLowQualityProductName(cleaned)) score -= 50;
  if (/[\u0400-\u04FF]/.test(cleaned)) score += 20;
  if ((cleaned.match(/,/g) || []).length >= 4) score -= 10;
  if (/[!#]{2,}/.test(name)) score -= 5;
  return score;
}

export function pickBestProductName(
  candidates: Array<string | null | undefined>,
): string {
  let best = "";
  let bestScore = -Infinity;
  for (const candidate of candidates) {
    if (!candidate?.trim()) continue;
    const cleaned = cleanProductName(candidate);
    if (!cleaned) continue;
    const score = scoreName(candidate);
    if (score > bestScore) {
      bestScore = score;
      best = cleaned;
    }
  }
  return best;
}

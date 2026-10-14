import { barcodeLookupValues, normalizeBarcode } from "@/lib/barcode";
import type { DocumentAiJsonComplete } from "@/lib/document-ai";
import { isDocumentAiConfigured } from "@/lib/document-ai";
import type { DocumentOcrRow } from "@/lib/document-ai";
import { shouldMockDocumentOcr } from "@/lib/document-ocr-mock";
import {
  requestZambooAiMatches,
  requestZambooFacetFilters,
  requestZambooScanQueries,
} from "@/lib/zamboo/ai-match";
import {
  loadZambooCatalog,
  type ZambooCatalogIndex,
  type ZambooCatalogItem,
} from "@/lib/zamboo/catalog";
import {
  catalogFacets,
  filterCatalogByQuery,
  mergeZambooQuery,
  queryFromScanName,
  retrieveByQueryTokens,
  type ZambooScanQuery,
} from "@/lib/zamboo/query";
import {
  extractSizes,
  normalizeZambooName,
  sizesCompatible,
  tokensMatch,
  zambooNameTokens,
} from "@/lib/zamboo/names";

export type ZambooMatchSource = "barcode" | "code" | "name" | "ai" | "fuzzy";
export type ZambooMatchConfidence = "high" | "medium" | "low";

export type ZambooMatch = {
  gId: string;
  name: string;
  code: string;
  source: ZambooMatchSource;
  confidence: ZambooMatchConfidence;
};

/** Only the final AI pick sees individual SKUs. Larger pools stay in local filters. */
export const ZAMBOO_FINAL_PICK_MAX = 40;
const MIN_FUZZY_SCORE = 0.72;
const MIN_FUZZY_GAP = 0.15;

function codeKeys(articul: string): string[] {
  const key = articul.trim();
  if (!key) return [];
  const keys = new Set<string>([key]);
  if (/^\d+$/.test(key)) {
    keys.add(String(Number(key)));
    keys.add(key.replace(/^0+/, "") || "0");
  }
  return [...keys];
}

function toMatch(
  item: Pick<ZambooCatalogItem, "gId" | "name" | "code">,
  source: ZambooMatchSource,
  confidence: ZambooMatchConfidence,
): ZambooMatch {
  return {
    gId: item.gId,
    name: item.name,
    code: item.code,
    source,
    confidence,
  };
}

export function exactZambooIdentityMatch(
  row: Pick<DocumentOcrRow, "name" | "barcode" | "articul">,
  catalog: ZambooCatalogIndex,
): ZambooMatch | null {
  if (row.barcode) {
    const normalized = normalizeBarcode(row.barcode) || row.barcode;
    for (const value of barcodeLookupValues(normalized)) {
      const hit = catalog.byBarcode.get(value);
      if (hit) return toMatch(hit, "barcode", "high");
    }
  }

  if (row.articul) {
    for (const key of codeKeys(row.articul)) {
      const hit = catalog.byCode.get(key);
      if (hit) return toMatch(hit, "code", "high");
    }
  }

  return null;
}

function retrievalScore(
  ocrTokens: string[],
  ocrSizes: string[],
  item: ZambooCatalogItem,
): number {
  if (item.tokens.length === 0 || ocrTokens.length === 0) return 0;

  let matchedCatalog = 0;
  for (const token of item.tokens) {
    if (ocrTokens.some((ocr) => tokensMatch(ocr, token))) matchedCatalog += 1;
  }
  if (matchedCatalog === 0) return 0;

  let matchedOcr = 0;
  for (const token of ocrTokens) {
    if (item.tokens.some((catalogToken) => tokensMatch(catalogToken, token))) {
      matchedOcr += 1;
    }
  }

  const catalogRatio = matchedCatalog / item.tokens.length;
  const ocrRatio = matchedOcr / ocrTokens.length;
  let score = catalogRatio * 0.5 + ocrRatio * 0.5;
  if (ocrSizes.length > 0 && item.sizes.some((size) => ocrSizes.includes(size))) {
    score += 0.15;
  } else if (ocrSizes.length > 0 && !sizesCompatible(ocrSizes, item.sizes)) {
    score -= 0.08;
  }
  const extraCatalog = item.tokens.filter(
    (token) => !ocrTokens.some((ocr) => tokensMatch(ocr, token)),
  ).length;
  if (extraCatalog > 0) score -= extraCatalog * 0.08;
  return Math.max(score, 0);
}

/** Every local hit for the scan tokens — not a top-12 guess. Can be hundreds/thousands. */
export function retrieveZambooCandidates(
  row: Pick<DocumentOcrRow, "name" | "barcode" | "articul">,
  catalog: ZambooCatalogIndex,
): ZambooCatalogItem[] {
  const query = queryFromScanName(row.name ?? "");
  if (query.include.length === 0) {
    const identity = exactZambooIdentityMatch(row, catalog);
    if (!identity) return [];
    const hit = catalog.items.find((item) => item.gId === identity.gId);
    return hit ? [hit] : [];
  }
  return filterCatalogByQuery(catalog, query);
}

/** @deprecated Use retrieveZambooCandidates — kept for older tests. */
export function shortlistZambooCandidates(
  row: Pick<DocumentOcrRow, "name" | "barcode" | "articul">,
  catalog: ZambooCatalogIndex,
): ZambooCatalogItem[] {
  return retrieveZambooCandidates(row, catalog);
}

export function heuristicZambooMatch(
  row: Pick<DocumentOcrRow, "name" | "barcode" | "articul">,
  catalog: ZambooCatalogIndex,
): ZambooMatch | null {
  const identity = exactZambooIdentityMatch(row, catalog);
  if (identity) return identity;

  const name = row.name?.trim() ?? "";
  if (!name) return null;
  const exact = catalog.byName.get(normalizeZambooName(name));
  if (exact) return toMatch(exact, "name", "high");

  const pool = retrieveZambooCandidates(row, catalog);
  if (pool.length === 0) return null;
  const ocrTokens = zambooNameTokens(name);
  const ocrSizes = extractSizes(name);
  const ranked = pool
    .map((item) => ({ item, score: retrievalScore(ocrTokens, ocrSizes, item) }))
    .sort((a, b) => b.score - a.score);
  const best = ranked[0];
  if (!best || best.score < MIN_FUZZY_SCORE) return null;
  const second = ranked[1];
  if (second && best.score - second.score < MIN_FUZZY_GAP) return null;
  return toMatch(best.item, "fuzzy", best.score >= 0.88 ? "high" : "medium");
}

export function matchZambooRowAgainstCatalog(
  row: Pick<DocumentOcrRow, "name" | "barcode" | "articul">,
  catalog: ZambooCatalogIndex,
): ZambooMatch | null {
  return heuristicZambooMatch(row, catalog);
}

export function shouldUseZambooAiMatch(): boolean {
  if (process.env.TEST_MODE === "1") return false;
  if (shouldMockDocumentOcr()) return false;
  return isDocumentAiConfigured();
}

function resolveQuery(
  row: Pick<DocumentOcrRow, "name" | "barcode" | "articul">,
  interpreted: ZambooScanQuery | undefined,
): ZambooScanQuery {
  const fallback = queryFromScanName(row.name ?? "");
  if (!interpreted || interpreted.include.length === 0) return fallback;
  return mergeZambooQuery(fallback, interpreted);
}

export async function matchZambooRows(
  rows: Pick<DocumentOcrRow, "name" | "barcode" | "articul">[],
  options?: {
    completeJson?: DocumentAiJsonComplete;
    useAi?: boolean;
  },
): Promise<Array<ZambooMatch | null>> {
  if (rows.length === 0) return [];
  const catalog = await loadZambooCatalog();
  if (catalog.items.length === 0) return rows.map(() => null);

  const exacts = rows.map((row) => exactZambooIdentityMatch(row, catalog));
  const useAi =
    options?.useAi ?? (options?.completeJson ? true : shouldUseZambooAiMatch());

  if (!useAi) {
    return rows.map((row, index) => exacts[index] ?? heuristicZambooMatch(row, catalog));
  }

  try {
    const interpreted = await requestZambooScanQueries(
      rows,
      options?.completeJson,
    );

    let remaining: ZambooCatalogItem[][] = rows.map((row, index) => {
      if (exacts[index]) return [];
      const query = resolveQuery(row, interpreted.get(index));
      const hits = filterCatalogByQuery(catalog, query);
      if (hits.length > 0) return hits;
      return retrieveByQueryTokens(catalog, query.include);
    });

    const large = remaining
      .map((items, i) => ({ i, items, scan: rows[i]?.name ?? "" }))
      .filter((row) => !exacts[row.i] && row.items.length > ZAMBOO_FINAL_PICK_MAX);

    if (large.length > 0) {
      const extra = await requestZambooFacetFilters(
        large.map((row) => ({
          i: row.i,
          scan: row.scan,
          facets: catalogFacets(row.items, resolveQuery(rows[row.i], interpreted.get(row.i))),
        })),
        options?.completeJson,
      );
      remaining = remaining.map((items, index) => {
        const extraQuery = extra.get(index);
        if (!extraQuery) return items;
        const merged = mergeZambooQuery(
          resolveQuery(rows[index], interpreted.get(index)),
          extraQuery,
        );
        const next = filterCatalogByQuery(catalog, merged);
        return next.length > 0 ? next : items;
      });
    }

    const pickRows = remaining.map((items) =>
      items.length > 1 && items.length <= ZAMBOO_FINAL_PICK_MAX ? items : [],
    );
    const picks = await requestZambooAiMatches(
      rows,
      pickRows,
      options?.completeJson,
    );

    return rows.map((row, index) => {
      if (exacts[index]) return exacts[index];
      const pool = remaining[index] ?? [];
      if (pool.length === 1) return toMatch(pool[0], "ai", "high");
      const pick = picks.get(index);
      if (pick) return toMatch(pick, "ai", "high");
      return heuristicZambooMatch(row, catalog);
    });
  } catch (error) {
    console.warn(
      "zamboo AI match failed, falling back to local scores",
      error instanceof Error ? error.message : error,
    );
    return rows.map((row, index) => exacts[index] ?? heuristicZambooMatch(row, catalog));
  }
}

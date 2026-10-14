import type { DocumentAiJsonComplete } from "@/lib/document-ai";
import { completeDocumentAiJson } from "@/lib/document-ai";
import type { DocumentOcrRow } from "@/lib/document-ai";
import type { ZambooCatalogItem } from "@/lib/zamboo/catalog";
import {
  catalogFacets,
  normalizeZambooQuery,
  type ZambooCatalogFacets,
  type ZambooScanQuery,
} from "@/lib/zamboo/query";

export const ZAMBOO_QUERY_SYSTEM = `You turn scanned Bulgarian delivery-note lines into catalog search queries.

The store catalog can have hundreds or thousands of similar SKUs (сирене, мляко, вино, Coca-Cola sizes). Do NOT pick a SKU. Extract filters only.

For each line return:
- include: brand/product words that must appear (Latin or transliterated, lowercase). Coca-Cola → ["koka","kola"].
- exclude: variant words the scan did NOT say (zero/ziro, cherry, vanilla) so those SKUs drop out.
- size: canonical pack size if printed (500ml, 1.5l, 400g) else null. Never invent a size.
- pack: "bottle" if bottle/бут/бутилка, "can" if can/кен, else null.

Return JSON only:
{"queries":[{"i":0,"include":["koka","kola"],"exclude":["ziro","zero"],"size":null,"pack":"bottle"}]}`;

export const ZAMBOO_FACET_SYSTEM = `The local catalog still has too many SKUs for these scan lines.
You see remaining counts and their facets (sizes, packs, distinctive tokens) — not a tiny sample of names.
Add filters so the local search can cut thousands down. Use only facet values you see.
Return JSON only:
{"filters":[{"i":0,"include":["krave"],"exclude":[],"size":"400g","pack":null}]}`;

export const ZAMBOO_MATCH_SYSTEM = `You pick the single best catalog SKU for each scanned line from the remaining local matches.

Those remaining rows already passed brand/size/pack filters. There may still be several.
Think: same variant, same pack, same size. Use ONLY a gId from that line's list. If none fit, gId null.
Return JSON only:
{"matches":[{"i":0,"gId":"...","reason":"short"}]}`;

export type ZambooAiMatchPick = {
  i: number;
  gId: string | null;
  reason: string;
};

function parseJsonObject(text: string): unknown {
  const trimmed = text.trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(trimmed.slice(start, end + 1));
  } catch {
    return null;
  }
}

function defaultComplete(system: string): DocumentAiJsonComplete {
  return (input) =>
    completeDocumentAiJson({
      system: input.system || system,
      user: input.user,
      maxOutputTokens: 8192,
      thinkingLevel: "medium",
    });
}

export function parseZambooAiQueries(
  text: string,
): Array<{ i: number } & ZambooScanQuery> {
  const parsed = parseJsonObject(text);
  if (!parsed || typeof parsed !== "object") return [];
  const queries = (parsed as { queries?: unknown; filters?: unknown }).queries
    ?? (parsed as { filters?: unknown }).filters;
  if (!Array.isArray(queries)) return [];
  const out: Array<{ i: number } & ZambooScanQuery> = [];
  for (const row of queries) {
    if (!row || typeof row !== "object") continue;
    const record = row as { i?: unknown };
    const index = Number(record.i);
    if (!Number.isInteger(index) || index < 0) continue;
    out.push({ i: index, ...normalizeZambooQuery(row) });
  }
  return out;
}

export function parseZambooAiMatches(text: string): ZambooAiMatchPick[] {
  const parsed = parseJsonObject(text);
  if (!parsed || typeof parsed !== "object") return [];
  const matches = (parsed as { matches?: unknown }).matches;
  if (!Array.isArray(matches)) return [];

  const out: ZambooAiMatchPick[] = [];
  for (const row of matches) {
    if (!row || typeof row !== "object") continue;
    const record = row as { i?: unknown; gId?: unknown; reason?: unknown };
    const index = Number(record.i);
    if (!Number.isInteger(index) || index < 0) continue;
    const gId =
      typeof record.gId === "string" && record.gId.trim()
        ? record.gId.trim()
        : null;
    const reason = typeof record.reason === "string" ? record.reason : "";
    out.push({ i: index, gId, reason });
  }
  return out;
}

export function applyZambooAiPicks(
  candidatesByRow: Array<ZambooCatalogItem[]>,
  picks: ZambooAiMatchPick[],
): Map<number, ZambooCatalogItem> {
  const byIndex = new Map(picks.map((pick) => [pick.i, pick]));
  const resolved = new Map<number, ZambooCatalogItem>();
  for (let index = 0; index < candidatesByRow.length; index += 1) {
    const pick = byIndex.get(index);
    if (!pick?.gId) continue;
    const hit = candidatesByRow[index]?.find((item) => item.gId === pick.gId);
    if (hit) resolved.set(index, hit);
  }
  return resolved;
}

export async function requestZambooScanQueries(
  rows: Pick<DocumentOcrRow, "name" | "barcode" | "articul">[],
  complete: DocumentAiJsonComplete = defaultComplete(ZAMBOO_QUERY_SYSTEM),
): Promise<Map<number, ZambooScanQuery>> {
  const lines = rows.map((row, i) => ({
    i,
    name: row.name ?? "",
    barcode: row.barcode ?? null,
    articul: row.articul ?? null,
  }));
  if (lines.length === 0) return new Map();
  const text = await complete({
    system: ZAMBOO_QUERY_SYSTEM,
    user: JSON.stringify({ lines }),
  });
  const parsed = parseZambooAiQueries(text);
  return new Map(parsed.map((query) => [query.i, query]));
}

export async function requestZambooFacetFilters(
  rows: Array<{
    i: number;
    scan: string;
    facets: ZambooCatalogFacets;
  }>,
  complete: DocumentAiJsonComplete = defaultComplete(ZAMBOO_FACET_SYSTEM),
): Promise<Map<number, ZambooScanQuery>> {
  if (rows.length === 0) return new Map();
  const text = await complete({
    system: ZAMBOO_FACET_SYSTEM,
    user: JSON.stringify({ lines: rows }),
  });
  const parsed = parseZambooAiQueries(text);
  return new Map(parsed.map((query) => [query.i, query]));
}

export async function requestZambooAiMatches(
  rows: Pick<DocumentOcrRow, "name" | "barcode" | "articul">[],
  candidatesByRow: Array<ZambooCatalogItem[]>,
  complete: DocumentAiJsonComplete = defaultComplete(ZAMBOO_MATCH_SYSTEM),
): Promise<Map<number, ZambooCatalogItem>> {
  const lines = [];
  for (let i = 0; i < rows.length; i += 1) {
    const candidates = candidatesByRow[i] ?? [];
    if (candidates.length === 0) continue;
    const row = rows[i];
    lines.push({
      i,
      scan: {
        name: row.name ?? "",
        barcode: row.barcode ?? null,
        articul: row.articul ?? null,
      },
      remaining: candidates.length,
      candidates: candidates.map((item) => ({
        gId: item.gId,
        name: item.name,
        code: item.code,
        barcode: item.barcode,
      })),
    });
  }
  if (lines.length === 0) return new Map();

  const text = await complete({
    system: ZAMBOO_MATCH_SYSTEM,
    user: JSON.stringify({ lines }),
  });
  return applyZambooAiPicks(candidatesByRow, parseZambooAiMatches(text));
}

export { catalogFacets };

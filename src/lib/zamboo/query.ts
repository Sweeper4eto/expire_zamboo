import type { ZambooCatalogIndex, ZambooCatalogItem } from "@/lib/zamboo/catalog";
import {
  canonicalizePackToken,
  canonicalizeSizeToken,
  extractPack,
  foldZambooToken,
  tokensMatch,
  zambooNameTokens,
  type ZambooPack,
} from "@/lib/zamboo/names";

export type ZambooScanQuery = {
  include: string[];
  exclude: string[];
  size: string | null;
  pack: ZambooPack | null;
};

export type ZambooCatalogFacets = {
  count: number;
  sizes: string[];
  packs: Array<ZambooPack | "unknown">;
  tokens: string[];
};

const MAX_FACET_VALUES = 40;

export function normalizeZambooQuery(raw: {
  include?: unknown;
  exclude?: unknown;
  size?: unknown;
  pack?: unknown;
}): ZambooScanQuery {
  const include = uniqueFolded(asStringArray(raw.include));
  const exclude = uniqueFolded(asStringArray(raw.exclude)).filter(
    (token) => !include.includes(token),
  );
  return {
    include,
    exclude,
    size: canonicalizeSizeToken(typeof raw.size === "string" ? raw.size : null),
    pack: canonicalizePackToken(typeof raw.pack === "string" ? raw.pack : null),
  };
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function uniqueFolded(values: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    for (const token of zambooNameTokens(value)) {
      const folded = foldZambooToken(token);
      if (!folded || seen.has(folded)) continue;
      seen.add(folded);
      out.push(folded);
    }
  }
  return out;
}

function postingList(
  catalog: ZambooCatalogIndex,
  token: string,
): ZambooCatalogItem[] {
  const exact = catalog.byToken.get(token);
  if (exact && exact.length > 0) return exact;
  const matches: ZambooCatalogItem[] = [];
  const seen = new Set<string>();
  for (const [key, items] of catalog.byToken) {
    if (!tokensMatch(key, token)) continue;
    for (const item of items) {
      if (seen.has(item.gId)) continue;
      seen.add(item.gId);
      matches.push(item);
    }
  }
  return matches;
}

/** Every local item that contains all include tokens — can be thousands. */
export function retrieveByQueryTokens(
  catalog: ZambooCatalogIndex,
  include: string[],
): ZambooCatalogItem[] {
  if (include.length === 0) return [];
  const lists = include
    .map((token) => postingList(catalog, token))
    .sort((a, b) => a.length - b.length);
  const [first, ...rest] = lists;
  if (!first || first.length === 0) return [];
  if (rest.length === 0) return first;

  let set = new Set(first.map((item) => item.gId));
  for (const list of rest) {
    const next = new Set<string>();
    for (const item of list) {
      if (set.has(item.gId)) next.add(item.gId);
    }
    set = next;
    if (set.size === 0) return [];
  }
  const byId = new Map(first.map((item) => [item.gId, item]));
  for (const list of rest) {
    for (const item of list) byId.set(item.gId, item);
  }
  return [...set].map((id) => byId.get(id)!);
}

export function applyZambooQuery(
  items: ZambooCatalogItem[],
  query: ZambooScanQuery,
): ZambooCatalogItem[] {
  return items.filter((item) => {
    if (query.exclude.length > 0) {
      const blocked = query.exclude.some((token) =>
        item.foldedTokens.some((itemToken) => tokensMatch(itemToken, token)),
      );
      if (blocked) return false;
    }
    if (query.size) {
      if (item.sizes.length > 0 && !item.sizes.includes(query.size)) return false;
    }
    if (query.pack === "can" && item.pack !== "can") return false;
    if (query.pack === "bottle" && item.pack === "can") return false;
    return true;
  });
}

export function filterCatalogByQuery(
  catalog: ZambooCatalogIndex,
  query: ZambooScanQuery,
): ZambooCatalogItem[] {
  const retrieved = retrieveByQueryTokens(catalog, query.include);
  return applyZambooQuery(retrieved, query);
}

export function catalogFacets(
  items: ZambooCatalogItem[],
  query: ZambooScanQuery,
): ZambooCatalogFacets {
  const sizes = new Set<string>();
  const packs = new Set<ZambooPack | "unknown">();
  const tokenCounts = new Map<string, number>();
  const include = new Set(query.include);

  for (const item of items) {
    for (const size of item.sizes) sizes.add(size);
    packs.add(item.pack ?? "unknown");
    for (const token of item.foldedTokens) {
      if (include.has(token)) continue;
      tokenCounts.set(token, (tokenCounts.get(token) ?? 0) + 1);
    }
  }

  const minCount = Math.max(2, Math.floor(items.length * 0.02));
  const tooCommon = Math.floor(items.length * 0.8);
  const tokens = [...tokenCounts.entries()]
    .filter(([, count]) => count >= minCount && count <= tooCommon)
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_FACET_VALUES)
    .map(([token]) => token);

  return {
    count: items.length,
    sizes: [...sizes].sort().slice(0, MAX_FACET_VALUES),
    packs: [...packs],
    tokens,
  };
}

export function mergeZambooQuery(
  base: ZambooScanQuery,
  extra: ZambooScanQuery,
): ZambooScanQuery {
  return {
    include: uniqueFolded([...base.include, ...extra.include]),
    exclude: uniqueFolded([...base.exclude, ...extra.exclude]),
    size: extra.size ?? base.size,
    pack: extra.pack ?? base.pack,
  };
}

export function queryFromScanName(name: string): ZambooScanQuery {
  return normalizeZambooQuery({
    include: zambooNameTokens(name),
    exclude: [],
    size: canonicalizeSizeToken(name),
    pack: extractPack(name),
  });
}

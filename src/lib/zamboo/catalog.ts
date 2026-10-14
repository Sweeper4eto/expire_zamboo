import { db } from "@/lib/db";
import {
  extractPack,
  extractSizes,
  foldZambooToken,
  normalizeZambooName,
  zambooNameTokens,
  type ZambooPack,
} from "@/lib/zamboo/names";

export type ZambooCatalogItem = {
  gId: string;
  name: string;
  altName: string;
  nameNormalized: string;
  code: string;
  barcode: string | null;
  tokens: string[];
  foldedTokens: string[];
  sizes: string[];
  pack: ZambooPack | null;
};

export type ZambooCatalogIndex = {
  items: ZambooCatalogItem[];
  byCode: Map<string, ZambooCatalogItem>;
  byBarcode: Map<string, ZambooCatalogItem>;
  byName: Map<string, ZambooCatalogItem>;
  byToken: Map<string, ZambooCatalogItem[]>;
};

let cached: ZambooCatalogIndex | null = null;

function toIndexItem(row: {
  gId: string;
  name: string;
  altName: string;
  nameNormalized: string;
  code: string;
  barcode: string | null;
}): ZambooCatalogItem {
  const altIsBarcode = Boolean(row.barcode && row.altName === row.barcode);
  const nameForTokens = altIsBarcode
    ? row.name
    : `${row.name} ${row.altName}`.trim();
  const tokens = zambooNameTokens(nameForTokens);
  return {
    gId: row.gId,
    name: row.name,
    altName: row.altName,
    nameNormalized: row.nameNormalized,
    code: row.code,
    barcode: row.barcode,
    tokens,
    foldedTokens: tokens.map((token) => foldZambooToken(token)),
    sizes: extractSizes(nameForTokens),
    pack: extractPack(nameForTokens),
  };
}

export function invalidateZambooCatalogCache(): void {
  cached = null;
}

export function buildZambooCatalogIndex(
  items: ZambooCatalogItem[],
): ZambooCatalogIndex {
  const byCode = new Map<string, ZambooCatalogItem>();
  const byBarcode = new Map<string, ZambooCatalogItem>();
  const byName = new Map<string, ZambooCatalogItem>();
  const byToken = new Map<string, ZambooCatalogItem[]>();
  const resolved = items.map((item) => {
    const foldedTokens =
      item.foldedTokens ?? item.tokens.map((token) => foldZambooToken(token));
    const pack = item.pack ?? extractPack(item.name);
    return { ...item, foldedTokens, pack };
  });

  for (const item of resolved) {
    if (!byCode.has(item.code)) byCode.set(item.code, item);
    if (item.barcode && !byBarcode.has(item.barcode)) {
      byBarcode.set(item.barcode, item);
    }
    if (!byName.has(item.nameNormalized)) {
      byName.set(item.nameNormalized, item);
    }
    const altNorm = item.altName ? normalizeZambooName(item.altName) : "";
    if (altNorm && !byName.has(altNorm)) byName.set(altNorm, item);
    for (const token of item.foldedTokens) {
      const list = byToken.get(token);
      if (list) list.push(item);
      else byToken.set(token, [item]);
    }
  }
  return { items: resolved, byCode, byBarcode, byName, byToken };
}

export function setZambooCatalogForTests(items: ZambooCatalogItem[]): void {
  cached = buildZambooCatalogIndex(items);
}

export async function loadZambooCatalog(): Promise<ZambooCatalogIndex> {
  if (cached) return cached;
  const rows = await db.zambooItem.findMany({
    where: { active: true },
    select: {
      gId: true,
      name: true,
      altName: true,
      nameNormalized: true,
      code: true,
      barcode: true,
    },
  });
  cached = buildZambooCatalogIndex(rows.map(toIndexItem));
  return cached;
}

export async function zambooCatalogCount(): Promise<number> {
  return db.zambooItem.count({ where: { active: true } });
}

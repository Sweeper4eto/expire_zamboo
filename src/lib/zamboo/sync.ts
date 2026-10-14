import { db } from "@/lib/db";
import { invalidateZambooCatalogCache } from "@/lib/zamboo/catalog";
import {
  fetchZambooItems,
  isZambooConfigured,
  type ZambooMaterialDto,
} from "@/lib/zamboo/client";
import { extractBarcode, normalizeZambooName } from "@/lib/zamboo/names";

export const ZAMBOO_SYNC_MAX_AGE_MS = 20 * 60 * 60 * 1000;
const INSERT_CHUNK = 400;

export type ZambooSyncResult = {
  skipped: boolean;
  reason?: "not_configured" | "fresh" | "test_mode";
  itemCount: number;
  lastSyncAt: string | null;
};

function mapMaterial(
  item: ZambooMaterialDto,
  syncedAt: Date,
): {
  gId: string;
  name: string;
  altName: string;
  nameNormalized: string;
  code: string;
  barcode: string | null;
  uomName: string | null;
  categoryName: string | null;
  typeName: string | null;
  itemType: number;
  basePrice: number;
  active: boolean;
  syncedAt: Date;
} | null {
  const gId = item.gId?.trim();
  const name = item.name?.trim() ?? "";
  if (!gId || !name || item.code == null || item.code === "") return null;
  const altName = item.altName?.trim() ?? "";
  const barcode = extractBarcode(altName);
  return {
    gId,
    name,
    altName,
    nameNormalized: normalizeZambooName(name),
    code: String(item.code),
    barcode,
    uomName: item.uom?.name?.trim() || null,
    categoryName: item.category?.name?.trim() || null,
    typeName: item.type?.name?.trim() || null,
    itemType: item.itemType ?? 1,
    basePrice: Number(item.basePrice) || 0,
    active: true,
    syncedAt,
  };
}

export async function getZambooSyncState(): Promise<{
  lastSyncAt: Date | null;
  itemCount: number;
  lastError: string | null;
}> {
  const row = await db.zambooSyncState.findUnique({ where: { id: 1 } });
  return {
    lastSyncAt: row?.lastSyncAt ?? null,
    itemCount: row?.itemCount ?? 0,
    lastError: row?.lastError ?? null,
  };
}

export async function syncZambooCatalog(options?: {
  fetchImpl?: typeof fetch;
  force?: boolean;
}): Promise<ZambooSyncResult> {
  if (process.env.TEST_MODE === "1" && !options?.force) {
    const state = await getZambooSyncState();
    return {
      skipped: true,
      reason: "test_mode",
      itemCount: state.itemCount,
      lastSyncAt: state.lastSyncAt?.toISOString() ?? null,
    };
  }
  if (!isZambooConfigured()) {
    const state = await getZambooSyncState();
    return {
      skipped: true,
      reason: "not_configured",
      itemCount: state.itemCount,
      lastSyncAt: state.lastSyncAt?.toISOString() ?? null,
    };
  }

  const materials = await fetchZambooItems(options?.fetchImpl);
  const syncedAt = new Date();
  const rows = materials
    .map((item) => mapMaterial(item, syncedAt))
    .filter((row): row is NonNullable<typeof row> => row !== null);

  await db.$transaction(
    async (tx) => {
      await tx.zambooItem.deleteMany();
      for (let i = 0; i < rows.length; i += INSERT_CHUNK) {
        await tx.zambooItem.createMany({
          data: rows.slice(i, i + INSERT_CHUNK),
        });
      }
      await tx.zambooSyncState.upsert({
        where: { id: 1 },
        create: {
          id: 1,
          lastSyncAt: syncedAt,
          itemCount: rows.length,
          lastError: null,
        },
        update: {
          lastSyncAt: syncedAt,
          itemCount: rows.length,
          lastError: null,
        },
      });
    },
    { timeout: 120_000 },
  );

  invalidateZambooCatalogCache();
  return {
    skipped: false,
    itemCount: rows.length,
    lastSyncAt: syncedAt.toISOString(),
  };
}

export async function syncZambooCatalogIfDue(options?: {
  fetchImpl?: typeof fetch;
  force?: boolean;
}): Promise<ZambooSyncResult> {
  if (!options?.force) {
    const state = await getZambooSyncState();
    if (
      state.lastSyncAt &&
      Date.now() - state.lastSyncAt.getTime() < ZAMBOO_SYNC_MAX_AGE_MS &&
      state.itemCount > 0
    ) {
      return {
        skipped: true,
        reason: "fresh",
        itemCount: state.itemCount,
        lastSyncAt: state.lastSyncAt.toISOString(),
      };
    }
  }

  try {
    return await syncZambooCatalog(options);
  } catch (error) {
    const message = error instanceof Error ? error.message : "ZAMBOO_SYNC_FAILED";
    await db.zambooSyncState.upsert({
      where: { id: 1 },
      create: { id: 1, lastError: message, itemCount: 0 },
      update: { lastError: message },
    });
    throw error;
  }
}

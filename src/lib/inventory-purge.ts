import { db } from "@/lib/db";

const ONE_MONTH_MS = 1000 * 60 * 60 * 24 * 30;

/**
 * Hard-delete inventory rows the user removed from the expiry list once
 * `removedAt` is at least ~1 month old. Does not delete by expiry date.
 *
 * Also clears legacy auto-purge soft-deletes (`deletedAt` only) so those
 * rows stay visible under the "All" filter.
 *
 * Orphan `NB…` product GC is not done here — that scans the whole Product
 * table and belongs on cron / the one-time cleanup script, not list reads.
 */
export async function purgeExpiredInventory(): Promise<number> {
  await db.inventoryEntry.updateMany({
    where: {
      deletedAt: { not: null },
      removedAt: null,
    },
    data: { deletedAt: null },
  });

  const cutoff = new Date(Date.now() - ONE_MONTH_MS);
  const result = await db.inventoryEntry.deleteMany({
    where: {
      removedAt: { not: null, lt: cutoff },
    },
  });

  return result.count;
}

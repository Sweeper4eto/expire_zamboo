import { isAdhocBarcode } from "@/lib/inventory-entry-display";
import { db } from "@/lib/db";
import { deleteLocalUpload } from "@/lib/upload";

/**
 * Catalog rule:
 * - Scanned or handwritten barcodes → shared global Product catalog.
 * - System-generated barcodes (`NB…`) → local scaffolding only; never catalog.
 *   Delete only when nothing still needs them: not in expiry, not in cart,
 *   and not in favourites.
 */
export async function deleteLocalProductIfUnused(
  productId: string,
): Promise<boolean> {
  const product = await db.product.findUnique({ where: { id: productId } });
  if (!product || !isAdhocBarcode(product.barcode)) return false;

  const [inventoryCount, buyListCount, favouriteCount] = await Promise.all([
    db.inventoryEntry.count({ where: { productId } }),
    db.buyListEntry.count({ where: { productId } }),
    db.favouriteProduct.count({ where: { productId } }),
  ]);
  if (inventoryCount + buyListCount + favouriteCount > 0) return false;

  await db.product.delete({ where: { id: productId } });
  if (product.imagePath) {
    await deleteLocalUpload(product.imagePath);
  }
  return true;
}

/**
 * Drop leftover soft-removed system-barcode rows and delete orphaned local
 * products (e.g. from before hard-delete-on-remove). Favourited locals are kept.
 */
export async function purgeOrphanedLocalProducts(): Promise<number> {
  const softInventory = await db.inventoryEntry.findMany({
    where: {
      removedAt: { not: null },
      barcode: { startsWith: "NB" },
    },
    select: { id: true, productId: true, imagePath: true },
  });

  const softBuyList = await db.buyListEntry.findMany({
    where: {
      removedAt: { not: null },
      barcode: { startsWith: "NB" },
    },
    select: { id: true, productId: true },
  });

  const productIds = new Set<string>();

  for (const row of softInventory) {
    productIds.add(row.productId);
    if (row.imagePath) await deleteLocalUpload(row.imagePath);
    await db.inventoryEntry.delete({ where: { id: row.id } });
  }

  for (const row of softBuyList) {
    productIds.add(row.productId);
    await db.buyListEntry.delete({ where: { id: row.id } });
  }

  let deletedProducts = 0;
  for (const productId of productIds) {
    if (await deleteLocalProductIfUnused(productId)) deletedProducts += 1;
  }

  const orphans = await db.$queryRaw<{ id: string }[]>`
    SELECT p.id AS id
    FROM Product p
    WHERE p.barcode LIKE 'NB%'
      AND NOT EXISTS (SELECT 1 FROM InventoryEntry i WHERE i.productId = p.id)
      AND NOT EXISTS (SELECT 1 FROM BuyListEntry b WHERE b.productId = p.id)
      AND NOT EXISTS (SELECT 1 FROM FavouriteProduct f WHERE f.productId = p.id)
  `;

  for (const row of orphans) {
    if (await deleteLocalProductIfUnused(row.id)) deletedProducts += 1;
  }

  return deletedProducts;
}

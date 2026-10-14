/**
 * Report / purge system-generated (NB…) products that are not in expiry,
 * cart, or favourites. Real scanned/handwritten barcodes are untouched.
 *
 *   npx tsx scripts/purge-local-products.ts --dry-run
 *   npx tsx scripts/purge-local-products.ts
 *
 * Uses DATABASE_URL (default file:./dev.db).
 */
import "dotenv/config";
import path from "node:path";
import Database from "better-sqlite3";
import { unlink } from "node:fs/promises";

type Args = { dryRun: boolean };

function parseArgs(argv: string[]): Args {
  return { dryRun: argv.includes("--dry-run") };
}

function resolveDbPath(databaseUrl: string): string {
  const raw = databaseUrl.replace(/^file:/, "");
  if (path.isAbsolute(raw)) return raw;
  return path.join(process.cwd(), raw);
}

async function deleteUpload(imagePath: string | null, dryRun: boolean) {
  if (!imagePath?.trim()) return;
  const relative = imagePath.replace(/^\/+/, "");
  if (!relative.startsWith("uploads/")) return;
  const full = path.join(process.cwd(), "public", relative);
  if (dryRun) return;
  try {
    await unlink(full);
  } catch {
    // Missing file is fine
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const databaseUrl = process.env.DATABASE_URL ?? "file:./dev.db";
  const dbPath = resolveDbPath(databaseUrl);
  console.log(`Database: ${dbPath}`);
  if (args.dryRun) console.log("Dry run — no writes.");

  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");

  const total = db.prepare("SELECT COUNT(*) AS c FROM Product").get() as {
    c: number;
  };
  const nb = db
    .prepare("SELECT COUNT(*) AS c FROM Product WHERE barcode LIKE 'NB%'")
    .get() as { c: number };

  const nbActiveInv = db
    .prepare(
      `SELECT COUNT(DISTINCT p.id) AS c
       FROM Product p
       JOIN InventoryEntry i ON i.productId = p.id
       WHERE p.barcode LIKE 'NB%'
         AND i.removedAt IS NULL
         AND i.deletedAt IS NULL`,
    )
    .get() as { c: number };

  const nbActiveBuy = db
    .prepare(
      `SELECT COUNT(DISTINCT p.id) AS c
       FROM Product p
       JOIN BuyListEntry b ON b.productId = p.id
       WHERE p.barcode LIKE 'NB%' AND b.removedAt IS NULL`,
    )
    .get() as { c: number };

  const nbFav = db
    .prepare(
      `SELECT COUNT(DISTINCT p.id) AS c
       FROM Product p
       JOIN FavouriteProduct f ON f.productId = p.id
       WHERE p.barcode LIKE 'NB%'`,
    )
    .get() as { c: number };

  const softInv = db
    .prepare(
      `SELECT COUNT(*) AS c FROM InventoryEntry
       WHERE removedAt IS NOT NULL AND barcode LIKE 'NB%'`,
    )
    .get() as { c: number };

  const softBuy = db
    .prepare(
      `SELECT COUNT(*) AS c FROM BuyListEntry
       WHERE removedAt IS NOT NULL AND barcode LIKE 'NB%'`,
    )
    .get() as { c: number };

  const orphans = db
    .prepare(
      `SELECT p.id AS id, p.imagePath AS imagePath
       FROM Product p
       WHERE p.barcode LIKE 'NB%'
         AND NOT EXISTS (SELECT 1 FROM InventoryEntry i WHERE i.productId = p.id)
         AND NOT EXISTS (SELECT 1 FROM BuyListEntry b WHERE b.productId = p.id)
         AND NOT EXISTS (SELECT 1 FROM FavouriteProduct f WHERE f.productId = p.id)`,
    )
    .all() as { id: string; imagePath: string | null }[];

  // Soft-removed-only: after dropping soft rows, these become orphans if no fav/active.
  const softOnlyCandidates = db
    .prepare(
      `SELECT COUNT(DISTINCT p.id) AS c
       FROM Product p
       WHERE p.barcode LIKE 'NB%'
         AND EXISTS (
           SELECT 1 FROM InventoryEntry i
           WHERE i.productId = p.id AND i.removedAt IS NOT NULL
         )
         AND NOT EXISTS (
           SELECT 1 FROM InventoryEntry i
           WHERE i.productId = p.id AND i.removedAt IS NULL
         )
         AND NOT EXISTS (
           SELECT 1 FROM BuyListEntry b
           WHERE b.productId = p.id AND b.removedAt IS NULL
         )
         AND NOT EXISTS (
           SELECT 1 FROM FavouriteProduct f WHERE f.productId = p.id
         )`,
    )
    .get() as { c: number };

  console.log(
    JSON.stringify(
      {
        totalProducts: total.c,
        systemGeneratedNb: nb.c,
        stillInActiveExpiry: nbActiveInv.c,
        stillInActiveCart: nbActiveBuy.c,
        stillInFavourites: nbFav.c,
        softRemovedNbInventoryRows: softInv.c,
        softRemovedNbBuyListRows: softBuy.c,
        alreadyOrphaned: orphans.length,
        softRemovedOnlyWouldBecomeOrphans: softOnlyCandidates.c,
      },
      null,
      2,
    ),
  );

  if (args.dryRun) {
    console.log(
      `Would delete ${orphans.length} orphan products now, plus soft-removed rows that unlock more.`,
    );
    db.close();
    return;
  }

  const softInvRows = db
    .prepare(
      `SELECT id, productId, imagePath FROM InventoryEntry
       WHERE removedAt IS NOT NULL AND barcode LIKE 'NB%'`,
    )
    .all() as { id: string; productId: string; imagePath: string | null }[];

  const softBuyRows = db
    .prepare(
      `SELECT id, productId FROM BuyListEntry
       WHERE removedAt IS NOT NULL AND barcode LIKE 'NB%'`,
    )
    .all() as { id: string; productId: string }[];

  const deleteInv = db.prepare("DELETE FROM InventoryEntry WHERE id = ?");
  const deleteBuy = db.prepare("DELETE FROM BuyListEntry WHERE id = ?");
  const deleteProduct = db.prepare("DELETE FROM Product WHERE id = ?");

  const tx = db.transaction(() => {
    for (const row of softInvRows) deleteInv.run(row.id);
    for (const row of softBuyRows) deleteBuy.run(row.id);
  });
  tx();

  for (const row of softInvRows) {
    await deleteUpload(row.imagePath, false);
  }

  const afterSoft = db
    .prepare(
      `SELECT p.id AS id, p.imagePath AS imagePath
       FROM Product p
       WHERE p.barcode LIKE 'NB%'
         AND NOT EXISTS (SELECT 1 FROM InventoryEntry i WHERE i.productId = p.id)
         AND NOT EXISTS (SELECT 1 FROM BuyListEntry b WHERE b.productId = p.id)
         AND NOT EXISTS (SELECT 1 FROM FavouriteProduct f WHERE f.productId = p.id)`,
    )
    .all() as { id: string; imagePath: string | null }[];

  const deleteTx = db.transaction((rows: { id: string }[]) => {
    for (const row of rows) deleteProduct.run(row.id);
  });
  deleteTx(afterSoft);

  for (const row of afterSoft) {
    await deleteUpload(row.imagePath, false);
  }

  console.log(
    `Deleted soft-removed rows: inventory=${softInvRows.length}, buyList=${softBuyRows.length}`,
  );
  console.log(`Deleted orphan NB products: ${afterSoft.length}`);
  db.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

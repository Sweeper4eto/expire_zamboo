/**
 * Clean Product.name values in the local DB (HTML entities, decorative punctuation).
 *
 *   npx tsx scripts/clean-product-names.ts
 *   npx tsx scripts/clean-product-names.ts --dry-run --limit 100
 */
import "dotenv/config";
import path from "node:path";
import Database from "better-sqlite3";
import {
  cleanProductName,
  isLowQualityProductName,
} from "../src/lib/product-name";

type Args = { dryRun: boolean; limit: number };

function parseArgs(argv: string[]): Args {
  const args: Args = { dryRun: false, limit: 0 };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--dry-run") args.dryRun = true;
    else if (argv[i] === "--limit") args.limit = Number(argv[++i] ?? "0");
  }
  return args;
}

function resolveDbPath(databaseUrl: string): string {
  const raw = databaseUrl.replace(/^file:/, "");
  if (path.isAbsolute(raw)) return raw;
  return path.join(process.cwd(), raw);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const databaseUrl = process.env.DATABASE_URL ?? "file:./prod-import.db";
  const dbPath = resolveDbPath(databaseUrl);
  console.log(`Database: ${dbPath}`);
  if (args.dryRun) console.log("Dry run - no writes.");

  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");

  const total = (
    db.prepare("SELECT COUNT(*) AS c FROM Product").get() as { c: number }
  ).c;
  console.log(`Products: ${total}`);

  const pageSize = 5000;
  const selectPage = db.prepare(
    `SELECT id, barcode, name FROM Product
     WHERE id > ?
     ORDER BY id
     LIMIT ?`,
  );
  const update = db.prepare(
    `UPDATE Product SET name = ?, updatedAt = ? WHERE id = ?`,
  );

  let scanned = 0;
  let changed = 0;
  let lowQuality = 0;
  const examples: Array<{ barcode: string; before: string; after: string }> =
    [];
  const now = new Date().toISOString();
  let lastId = "";

  const applyBatch = db.transaction(
    (rows: Array<{ id: string; name: string }>) => {
      for (const row of rows) update.run(row.name, now, row.id);
    },
  );

  while (true) {
    if (args.limit > 0 && scanned >= args.limit) break;
    const take =
      args.limit > 0
        ? Math.min(pageSize, args.limit - scanned)
        : pageSize;
    const rows = selectPage.all(lastId, take) as Array<{
      id: string;
      barcode: string;
      name: string;
    }>;
    if (!rows.length) break;

    const pending: Array<{ id: string; name: string }> = [];
    for (const row of rows) {
      scanned += 1;
      const after = cleanProductName(row.name);
      if (isLowQualityProductName(after || row.name)) lowQuality += 1;
      if (after && after !== row.name) {
        changed += 1;
        if (examples.length < 25) {
          examples.push({ barcode: row.barcode, before: row.name, after });
        }
        if (!args.dryRun) pending.push({ id: row.id, name: after });
      }
    }

    if (!args.dryRun && pending.length) applyBatch(pending);
    lastId = rows[rows.length - 1].id;

    if (scanned % 250000 < pageSize) {
      console.log(`... scanned ${scanned}, changed ${changed}`);
    }
  }

  console.log("\nDone.", {
    scanned,
    changed,
    stillLowQualityApprox: lowQuality,
  });
  console.log("Examples:");
  for (const ex of examples) {
    console.log(
      `  ${ex.barcode}\n    before: ${ex.before}\n    after:  ${ex.after}`,
    );
  }
  db.close();
}

main();

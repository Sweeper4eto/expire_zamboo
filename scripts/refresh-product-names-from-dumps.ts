/**
 * Refresh Product.name from Open Food Facts family dumps, applying cleanProductName.
 * Restores names from source data (safer than cleaning already-mutated DB values).
 *
 *   npx tsx scripts/refresh-product-names-from-dumps.ts --source all-sources
 */
import "dotenv/config";
import { createReadStream, existsSync } from "node:fs";
import { createInterface } from "node:readline";
import path from "node:path";
import Database from "better-sqlite3";
import { normalizeBarcode } from "../src/lib/barcode";
import { pickBestProductName } from "../src/lib/product-name";

const SOURCES: Record<string, { file: string; label: string }> = {
  food: { label: "Open Food Facts", file: "openfoodfacts.tsv" },
  beauty: { label: "Open Beauty Facts", file: "openbeautyfacts.tsv" },
  pet: { label: "Open Pet Food Facts", file: "openpetfoodfacts.tsv" },
  products: { label: "Open Products Facts", file: "openproductsfacts.tsv" },
};

type Args = { source: string; dryRun: boolean; limit: number };

function parseArgs(argv: string[]): Args {
  const args: Args = { source: "all-sources", dryRun: false, limit: 0 };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--dry-run") args.dryRun = true;
    else if (argv[i] === "--source") args.source = argv[++i] ?? "all-sources";
    else if (argv[i] === "--limit") args.limit = Number(argv[++i] ?? "0");
  }
  return args;
}

function resolveDbPath(databaseUrl: string): string {
  const raw = databaseUrl.replace(/^file:/, "");
  if (path.isAbsolute(raw)) return raw;
  return path.join(process.cwd(), raw);
}

async function refreshFromFile(
  db: Database.Database,
  filePath: string,
  args: Args,
  stats: { scanned: number; updated: number; skipped: number },
): Promise<void> {
  console.log(`Reading ${filePath}`);
  const select = db.prepare(`SELECT id, name FROM Product WHERE barcode = ?`);
  const update = db.prepare(
    `UPDATE Product SET name = ?, updatedAt = ? WHERE id = ?`,
  );

  const input = createReadStream(filePath, { encoding: "utf8" });
  const lines = createInterface({ input, crlfDelay: Infinity });

  let headers: string[] | null = null;
  let codeIndex = -1;
  let nameIndexes: number[] = [];

  for await (const line of lines) {
    if (!headers) {
      headers = line.split("\t");
      codeIndex = headers.indexOf("code");
      nameIndexes = [
        "product_name_bg",
        "product_name",
        "product_name_en",
        "generic_name",
        "brands",
      ]
        .map((key) => headers!.indexOf(key))
        .filter((index) => index >= 0);
      if (codeIndex < 0) throw new Error("Dump missing code column");
      continue;
    }

    stats.scanned += 1;
    if (stats.scanned % 250000 === 0) {
      console.log(
        `... scanned ${stats.scanned}, updated ${stats.updated}, skipped ${stats.skipped}`,
      );
    }

    const cols = line.split("\t");
    const barcode = normalizeBarcode(cols[codeIndex] ?? "");
    if (!barcode) continue;

    const product = select.get(barcode) as
      | { id: string; name: string }
      | undefined;
    if (!product) {
      stats.skipped += 1;
      continue;
    }

    const candidates = nameIndexes.map((index) => cols[index] ?? "");
    const nextName = pickBestProductName(candidates);
    if (!nextName || nextName === product.name) {
      stats.skipped += 1;
      continue;
    }

    if (!args.dryRun) {
      update.run(nextName, new Date().toISOString(), product.id);
    }
    stats.updated += 1;

    if (args.limit > 0 && stats.updated >= args.limit) return;
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const sourceKeys =
    args.source === "rest"
      ? ["beauty", "pet", "products"]
      : args.source === "all-sources"
        ? ["food", "beauty", "pet", "products"]
        : [args.source];

  const databaseUrl = process.env.DATABASE_URL ?? "file:./prod-import.db";
  const dbPath = resolveDbPath(databaseUrl);
  console.log(`Database: ${dbPath}`);
  if (args.dryRun) console.log("Dry run - no writes.");

  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");

  const stats = { scanned: 0, updated: 0, skipped: 0 };

  for (const key of sourceKeys) {
    const source = SOURCES[key];
    if (!source) {
      console.error(`Unknown source ${key}`);
      process.exit(1);
    }
    const filePath = path.join(process.cwd(), "data", source.file);
    if (!existsSync(filePath)) {
      console.error(`Missing dump: ${filePath}`);
      process.exit(1);
    }
    console.log(`\n=== ${source.label} ===`);
    await refreshFromFile(db, filePath, args, stats);
    if (args.limit > 0 && stats.updated >= args.limit) break;
  }

  console.log("\nDone.", stats);
  db.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

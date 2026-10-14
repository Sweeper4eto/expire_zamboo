/**
 * Populate Product.imagePath from Open Food Facts family dumps.
 *
 * Default: store CDN URLs (fast, no disk). Use --download to save files locally.
 *
 * Examples:
 *   npx tsx scripts/populate-product-images.ts --source food
 *   npx tsx scripts/populate-product-images.ts --source all-sources --prefix 380 --limit 5000
 *   npx tsx scripts/populate-product-images.ts --source food --download --limit 200 --delay 200
 */
import "dotenv/config";
import { createReadStream, existsSync } from "node:fs";
import { createInterface } from "node:readline";
import path from "node:path";
import Database from "better-sqlite3";
import { normalizeBarcode } from "../src/lib/barcode";
import {
  isLocalUploadPath,
  saveRemoteProductImage,
} from "../src/lib/product-image";

const SOURCES: Record<string, { file: string; label: string }> = {
  food: { label: "Open Food Facts", file: "openfoodfacts.tsv" },
  beauty: { label: "Open Beauty Facts", file: "openbeautyfacts.tsv" },
  pet: { label: "Open Pet Food Facts", file: "openpetfoodfacts.tsv" },
  products: { label: "Open Products Facts", file: "openproductsfacts.tsv" },
};

type Args = {
  source: string;
  prefix: string;
  limit: number;
  download: boolean;
  dryRun: boolean;
  delayMs: number;
  preferSmall: boolean;
};

function parseArgs(argv: string[]): Args {
  const args: Args = {
    source: "food",
    prefix: "",
    limit: 0,
    download: false,
    dryRun: false,
    delayMs: 150,
    preferSmall: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--download") args.download = true;
    else if (arg === "--dry-run") args.dryRun = true;
    else if (arg === "--large") args.preferSmall = false;
    else if (arg === "--all") args.prefix = "";
    else if (arg === "--source") args.source = argv[++i] ?? "food";
    else if (arg === "--prefix") args.prefix = argv[++i] ?? "";
    else if (arg === "--limit") args.limit = Number(argv[++i] ?? "0");
    else if (arg === "--delay") args.delayMs = Number(argv[++i] ?? "150");
  }
  return args;
}

function resolveDbPath(databaseUrl: string): string {
  const raw = databaseUrl.replace(/^file:/, "");
  if (path.isAbsolute(raw)) return raw;
  return path.join(process.cwd(), raw);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function populateFromFile(
  db: Database.Database,
  filePath: string,
  args: Args,
): Promise<{
  scanned: number;
  withImageInDump: number;
  updated: number;
  skippedHasLocal: number;
  skippedMissingProduct: number;
  downloadFailed: number;
}> {
  console.log(`Reading ${filePath}`);
  console.log(`Mode: ${args.download ? "download to /uploads" : "store CDN URL"}`);
  console.log(`Prefix: ${args.prefix || "(none)"}`);
  if (args.limit > 0) console.log(`Limit: ${args.limit}`);
  if (args.dryRun) console.log("Dry run — no writes.");

  const selectProduct = db.prepare(
    `SELECT id, imagePath FROM Product WHERE barcode = ?`,
  );
  const updateProduct = db.prepare(
    `UPDATE Product SET imagePath = ?, updatedAt = ? WHERE id = ?`,
  );

  const input = createReadStream(filePath, { encoding: "utf8" });
  const lines = createInterface({ input, crlfDelay: Infinity });

  let headers: string[] | null = null;
  let codeIndex = -1;
  let imageIndex = -1;
  let imageSmallIndex = -1;

  let scanned = 0;
  let withImageInDump = 0;
  let updated = 0;
  let skippedHasLocal = 0;
  let skippedMissingProduct = 0;
  let downloadFailed = 0;

  for await (const line of lines) {
    if (!headers) {
      headers = line.split("\t");
      codeIndex = headers.indexOf("code");
      imageIndex = headers.indexOf("image_url");
      imageSmallIndex = headers.indexOf("image_small_url");
      if (codeIndex < 0) throw new Error("Dump missing 'code' column");
      if (imageIndex < 0 && imageSmallIndex < 0) {
        throw new Error("Dump missing image_url / image_small_url columns");
      }
      continue;
    }

    scanned += 1;
    if (scanned % 200000 === 0) {
      console.log(
        `... scanned ${scanned}, dump images ${withImageInDump}, updated ${updated}`,
      );
    }

    const cols = line.split("\t");
    const rawCode = cols[codeIndex] ?? "";
    if (args.prefix && !rawCode.startsWith(args.prefix)) continue;

    const barcode = normalizeBarcode(rawCode);
    if (!barcode) continue;
    if (args.prefix && !barcode.startsWith(args.prefix)) continue;

    const small = imageSmallIndex >= 0 ? cols[imageSmallIndex]?.trim() : "";
    const large = imageIndex >= 0 ? cols[imageIndex]?.trim() : "";
    const remoteUrl = args.preferSmall
      ? small || large
      : large || small;
    if (!remoteUrl || !/^https?:\/\//i.test(remoteUrl)) continue;

    withImageInDump += 1;

    const product = selectProduct.get(barcode) as
      | { id: string; imagePath: string | null }
      | undefined;
    if (!product) {
      skippedMissingProduct += 1;
      continue;
    }
    if (isLocalUploadPath(product.imagePath)) {
      skippedHasLocal += 1;
      continue;
    }
    // Already has this (or any) remote URL — still allow overwrite with better URL only if empty
    if (product.imagePath && product.imagePath.trim()) {
      skippedHasLocal += 1;
      continue;
    }

    let imagePath = remoteUrl.replace(/\.(100|200)\./g, ".400.");
    if (args.download) {
      const local = await saveRemoteProductImage(remoteUrl);
      if (!local) {
        downloadFailed += 1;
        if (args.delayMs > 0) await sleep(args.delayMs);
        continue;
      }
      imagePath = local;
      if (args.delayMs > 0) await sleep(args.delayMs);
    }

    if (!args.dryRun) {
      updateProduct.run(imagePath, new Date().toISOString(), product.id);
    }
    updated += 1;

    if (args.limit > 0 && updated >= args.limit) break;
  }

  return {
    scanned,
    withImageInDump,
    updated,
    skippedHasLocal,
    skippedMissingProduct,
    downloadFailed,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const sourceKeys =
    args.source === "rest"
      ? ["beauty", "pet", "products"]
      : args.source === "all-sources"
        ? ["food", "beauty", "pet", "products"]
        : [args.source];

  for (const key of sourceKeys) {
    if (!SOURCES[key]) {
      console.error(
        `Unknown source "${key}". Use: food | beauty | pet | products | rest | all-sources`,
      );
      process.exit(1);
    }
  }

  const databaseUrl = process.env.DATABASE_URL ?? "file:./prod-import.db";
  const dbPath = resolveDbPath(databaseUrl);
  console.log(`Database: ${dbPath}`);
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");

  for (const key of sourceKeys) {
    const source = SOURCES[key];
    const filePath = path.join(process.cwd(), "data", source.file);
    console.log(`\n=== ${source.label} ===`);
    if (!existsSync(filePath)) {
      console.error(`Missing dump: ${filePath}`);
      console.error("Run: npm run db:import-off -- --source <name> --download --all");
      process.exit(1);
    }
    const stats = await populateFromFile(db, filePath, args);
    console.log("Source done.", stats);
    if (args.limit > 0 && stats.updated >= args.limit) break;
  }

  const withImage = db
    .prepare(
      `SELECT COUNT(*) AS c FROM Product WHERE imagePath IS NOT NULL AND trim(imagePath) != ''`,
    )
    .get() as { c: number };
  console.log("\nProducts with imagePath:", withImage.c);
  db.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

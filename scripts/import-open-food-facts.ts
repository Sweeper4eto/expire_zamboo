/**
 * Import products (barcode + name, no images) from Open Food / Beauty / Pet / Products Facts dumps.
 *
 * Examples:
 *   npx tsx scripts/import-open-food-facts.ts --source food --download --all
 *   npx tsx scripts/import-open-food-facts.ts --source beauty --download --all
 *   npx tsx scripts/import-open-food-facts.ts --source pet --download --all
 *   npx tsx scripts/import-open-food-facts.ts --source products --download --all
 *   npx tsx scripts/import-open-food-facts.ts --source rest --download --all
 */
import "dotenv/config";
import { createReadStream, createWriteStream, existsSync, mkdirSync } from "node:fs";
import { createInterface } from "node:readline";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { createGunzip } from "node:zlib";
import path from "node:path";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../src/generated/prisma/client";
import { normalizeBarcode } from "../src/lib/barcode";
import { cleanProductName } from "../src/lib/product-name";

const OFF_USER_AGENT =
  "Magazin/1.0 (https://github.com/Sweeper4eto/barcodescanner; product import)";

const SOURCES: Record<string, { url: string; file: string; label: string }> = {
  food: {
    label: "Open Food Facts",
    url: "https://static.openfoodfacts.org/data/en.openfoodfacts.org.products.csv.gz",
    file: "openfoodfacts.tsv",
  },
  beauty: {
    label: "Open Beauty Facts",
    url: "https://static.openbeautyfacts.org/data/en.openbeautyfacts.org.products.csv.gz",
    file: "openbeautyfacts.tsv",
  },
  pet: {
    label: "Open Pet Food Facts",
    url: "https://static.openpetfoodfacts.org/data/en.openpetfoodfacts.org.products.csv.gz",
    file: "openpetfoodfacts.tsv",
  },
  products: {
    label: "Open Products Facts",
    url: "https://static.openproductsfacts.org/data/en.openproductsfacts.org.products.csv.gz",
    file: "openproductsfacts.tsv",
  },
};

type Args = {
  file?: string;
  source: string;
  download: boolean;
  prefix: string;
  limit: number;
  dryRun: boolean;
};

function parseArgs(argv: string[]): Args {
  const args: Args = {
    download: false,
    source: "food",
    prefix: "",
    limit: 0,
    dryRun: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--download") args.download = true;
    else if (arg === "--dry-run") args.dryRun = true;
    else if (arg === "--all") args.prefix = "";
    else if (arg === "--file") args.file = argv[++index];
    else if (arg === "--source") args.source = argv[++index] ?? "food";
    else if (arg === "--prefix") args.prefix = argv[++index] ?? "";
    else if (arg === "--limit") args.limit = Number(argv[++index] ?? "0");
  }

  return args;
}

async function downloadDump(url: string, targetPath: string, label: string): Promise<void> {
  mkdirSync(path.dirname(targetPath), { recursive: true });
  console.log(`Downloading ${label} dump to ${targetPath} ...`);
  const response = await fetch(url, {
    headers: { "User-Agent": OFF_USER_AGENT },
  });
  if (!response.ok || !response.body) {
    throw new Error(`Download failed: HTTP ${response.status}`);
  }

  const gzipPath = `${targetPath}.gz`;
  const webStream = response.body as unknown as import("node:stream/web").ReadableStream;
  await pipeline(Readable.fromWeb(webStream), createWriteStream(gzipPath));

  console.log("Decompressing...");
  await pipeline(
    createReadStream(gzipPath),
    createGunzip(),
    createWriteStream(targetPath),
  );
  console.log("Download ready.");
}

async function importFile(
  db: PrismaClient,
  filePath: string,
  args: Pick<Args, "prefix" | "limit" | "dryRun">,
): Promise<{
  scanned: number;
  matched: number;
  inserted: number;
  skippedExisting: number;
  skippedNoName: number;
}> {
  console.log(`Importing from ${filePath}`);
  console.log(`Barcode prefix filter: ${args.prefix || "(none)"}`);
  if (args.limit > 0) console.log(`Limit: ${args.limit}`);
  if (args.dryRun) console.log("Dry run — no writes.");

  const existingCount = await db.product.count();
  console.log(`Existing products: ${existingCount}`);

  const input = createReadStream(filePath, { encoding: "utf8" });
  const lines = createInterface({ input, crlfDelay: Infinity });

  let headers: string[] | null = null;
  let codeIndex = -1;
  let nameIndexes: number[] = [];
  let scanned = 0;
  let matched = 0;
  let inserted = 0;
  let skippedExisting = 0;
  let skippedNoName = 0;
  const batch: Array<{ barcode: string; name: string }> = [];

  async function flush() {
    if (!batch.length) return;
    if (args.dryRun) {
      inserted += batch.length;
      batch.length = 0;
      return;
    }

    const now = new Date().toISOString();
    const valuesSql = batch
      .map(
        () =>
          `(lower(hex(randomblob(8))) || lower(hex(randomblob(4))), ?, ?, NULL, ?, ?)`,
      )
      .join(", ");
    const params = batch.flatMap((row) => [row.barcode, row.name, now, now]);
    const added = Number(
      await db.$executeRawUnsafe(
        `INSERT OR IGNORE INTO "Product" ("id", "barcode", "name", "imagePath", "createdAt", "updatedAt") VALUES ${valuesSql}`,
        ...params,
      ),
    );
    inserted += added;
    skippedExisting += batch.length - added;
    batch.length = 0;
  }

  for await (const line of lines) {
    if (!headers) {
      headers = line.split("\t");
      codeIndex = headers.indexOf("code");
      if (codeIndex < 0) {
        throw new Error("CSV/TSV missing required 'code' column");
      }
      nameIndexes = [
        "product_name_bg",
        "product_name",
        "product_name_en",
        "generic_name",
        "brands",
      ]
        .map((key) => headers!.indexOf(key))
        .filter((index) => index >= 0);
      continue;
    }

    scanned += 1;
    if (scanned % 100000 === 0) {
      console.log(
        `... scanned ${scanned}, matched ${matched}, inserted ${inserted}, skipped existing ${skippedExisting}`,
      );
    }

    const cols = line.split("\t");
    const rawCode = cols[codeIndex] ?? "";
    if (args.prefix && !rawCode.startsWith(args.prefix)) continue;

    const barcode = normalizeBarcode(rawCode);
    if (!barcode) continue;
    if (args.prefix && !barcode.startsWith(args.prefix)) continue;

    matched += 1;

    let name = "";
    for (const index of nameIndexes) {
      const candidate = cols[index]?.trim();
      if (candidate) {
        name = cleanProductName(candidate);
        if (name) break;
      }
    }
    if (!name) {
      skippedNoName += 1;
      continue;
    }

    batch.push({ barcode, name });
    if (batch.length >= 500) await flush();

    if (args.limit > 0 && inserted >= args.limit) {
      await flush();
      break;
    }
  }

  await flush();
  return { scanned, matched, inserted, skippedExisting, skippedNoName };
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
    const source = SOURCES[key];
    if (!source) {
      console.error(
        `Unknown source "${key}". Use: food | beauty | pet | products | rest | all-sources`,
      );
      process.exit(1);
    }
  }

  const databaseUrl = process.env.DATABASE_URL ?? "file:./prod-import.db";
  const adapter = new PrismaBetterSqlite3({ url: databaseUrl });
  const db = new PrismaClient({ adapter });
  console.log(`Database: ${databaseUrl}`);

  for (const key of sourceKeys) {
    const source = SOURCES[key];
    console.log(`\n=== ${source.label} ===`);
    const filePath =
      args.file && sourceKeys.length === 1
        ? args.file
        : path.join(process.cwd(), "data", source.file);

    if (args.download || !existsSync(filePath)) {
      if (!args.download && !existsSync(filePath)) {
        console.log(`File not found: ${filePath}`);
        console.log("Pass --download to fetch the dump.");
        process.exit(1);
      }
      await downloadDump(source.url, filePath, source.label);
    }

    const stats = await importFile(db, filePath, args);
    const total = await db.product.count();
    console.log("Source done.", { ...stats, totalProducts: total });
  }

  const total = await db.product.count();
  await db.$disconnect();
  console.log("\nAll requested sources finished.");
  console.log({ totalProducts: total });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

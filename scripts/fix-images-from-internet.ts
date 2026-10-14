/**
 * Fetch product images from non-OFF free sources for products missing images
 * (and optionally replace tiny/broken ones).
 *
 * Sources: Barcode Spider, Buycott, UPCitemdb (100/day), Go-UPC.
 *
 *   npx tsx scripts/fix-images-from-internet.ts
 *   npx tsx scripts/fix-images-from-internet.ts --minutes 55 --concurrency 1
 *   npx tsx scripts/fix-images-from-internet.ts --missing-only --limit 100 --dry-run
 */
import "dotenv/config";
import path from "node:path";
import Database from "better-sqlite3";
import { saveRemoteProductImage } from "../src/lib/product-image";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

type Args = {
  minutes: number;
  concurrency: number;
  dryRun: boolean;
  limit: number;
  missingOnly: boolean;
  download: boolean;
};

function parseArgs(argv: string[]): Args {
  const args: Args = {
    minutes: 55,
    concurrency: 1,
    dryRun: false,
    limit: 0,
    missingOnly: true,
    download: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--dry-run") args.dryRun = true;
    else if (argv[i] === "--download") args.download = true;
    else if (argv[i] === "--all") args.missingOnly = false;
    else if (argv[i] === "--missing-only") args.missingOnly = true;
    else if (argv[i] === "--minutes") args.minutes = Number(argv[++i] ?? "55");
    else if (argv[i] === "--concurrency")
      args.concurrency = Number(argv[++i] ?? "1");
    else if (argv[i] === "--limit") args.limit = Number(argv[++i] ?? "0");
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

function barcodeVariants(barcode: string): string[] {
  const digits = String(barcode || "").replace(/\D/g, "");
  if (!digits) return [];
  const out: string[] = [];
  const push = (v: string) => {
    if (v && !out.includes(v)) out.push(v);
  };
  push(digits);
  const stripped = digits.replace(/^0+/, "") || "0";
  push(stripped);
  if (stripped.length < 13) push(stripped.padStart(13, "0"));
  if (stripped.length === 11) push(stripped.padStart(12, "0"));
  return out.slice(0, 3);
}

function absUrl(base: string, src: string): string | null {
  if (!src) return null;
  if (src.startsWith("//")) return `https:${src}`;
  if (/^https?:\/\//i.test(src)) return src;
  try {
    return new URL(src, base).href;
  } catch {
    return null;
  }
}

function looksLikeProductImage(url: string): boolean {
  const u = url.toLowerCase();
  if (/logo|icon|sprite|favicon|badge|avatar|placeholder|pixel|1x1|tracking/i.test(u)) {
    return false;
  }
  return /\.(jpe?g|png|webp)(\?|$)/i.test(u) || /\/images?\/|cdn|media|upload|cloud/i.test(u);
}

let buycottCooldownUntil = 0;
let goUpcCooldownUntil = 0;
let upcItemDbCooldownUntil = 0;
let upcItemDbCallsToday = 0;

async function lookupBarcodeSpider(barcode: string): Promise<string | null> {
  for (const code of barcodeVariants(barcode)) {
    try {
      const pageUrl = `https://www.barcodespider.com/${code}`;
      const response = await fetch(pageUrl, {
        headers: { "User-Agent": USER_AGENT, Accept: "text/html" },
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) continue;
      const html = await response.text();
      if (/product not found/i.test(html)) continue;
      const og =
        html.match(/property=["']og:image["']\s+content=["']([^"']+)/i)?.[1] ||
        html.match(/content=["']([^"']+)["']\s+property=["']og:image["']/i)?.[1];
      if (og) {
        const url = absUrl(pageUrl, og);
        if (url && looksLikeProductImage(url)) return url;
      }
      const imgs = [...html.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)].map(
        (m) => m[1],
      );
      for (const src of imgs) {
        const url = absUrl(pageUrl, src);
        if (url && looksLikeProductImage(url) && !/barcodespider\.com\/static/i.test(url)) {
          return url;
        }
      }
    } catch {
      // next
    }
  }
  return null;
}

async function lookupBuycott(barcode: string): Promise<string | null> {
  if (Date.now() < buycottCooldownUntil) return null;
  for (const code of barcodeVariants(barcode)) {
    try {
      const pageUrl = `https://www.buycott.com/upc/${code}`;
      const response = await fetch(pageUrl, {
        headers: { "User-Agent": USER_AGENT, Accept: "text/html" },
        signal: AbortSignal.timeout(15000),
      });
      if (response.status === 429) {
        buycottCooldownUntil = Date.now() + 120_000;
        console.log("buycott rate limited — cooling down 120s");
        return null;
      }
      if (response.status === 404 || !response.ok) continue;
      const html = await response.text();
      if (/no products found|product not found/i.test(html)) continue;
      const og =
        html.match(/property=["']og:image["']\s+content=["']([^"']+)/i)?.[1] ||
        html.match(/content=["']([^"']+)["']\s+property=["']og:image["']/i)?.[1];
      const url = og ? absUrl(pageUrl, og) : null;
      if (url && looksLikeProductImage(url)) return url;
    } catch {
      // next
    }
  }
  return null;
}

async function lookupUpcItemDb(barcode: string): Promise<string | null> {
  if (Date.now() < upcItemDbCooldownUntil) return null;
  if (upcItemDbCallsToday >= 95) return null;

  for (const code of barcodeVariants(barcode)) {
    try {
      upcItemDbCallsToday += 1;
      const response = await fetch(
        `https://api.upcitemdb.com/prod/trial/lookup?upc=${encodeURIComponent(code)}`,
        {
          headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
          signal: AbortSignal.timeout(12000),
        },
      );
      if (response.status === 429) {
        upcItemDbCooldownUntil = Date.now() + 60_000;
        console.log("upcitemdb rate limited — cooling down 60s");
        return null;
      }
      if (!response.ok) continue;
      const data = (await response.json()) as {
        items?: Array<{ images?: string[] }>;
      };
      const images = data.items?.[0]?.images ?? [];
      for (const img of images) {
        if (img && looksLikeProductImage(img)) return img;
      }
    } catch {
      // next
    }
  }
  return null;
}

async function lookupGoUpc(barcode: string): Promise<string | null> {
  if (Date.now() < goUpcCooldownUntil) return null;
  for (const code of barcodeVariants(barcode)) {
    try {
      const pageUrl = `https://go-upc.com/search?q=${encodeURIComponent(code)}`;
      const response = await fetch(pageUrl, {
        headers: { "User-Agent": USER_AGENT, Accept: "text/html" },
        signal: AbortSignal.timeout(15000),
      });
      if (response.status === 429) {
        goUpcCooldownUntil = Date.now() + 90_000;
        console.log("go-upc rate limited — cooling down 90s");
        return null;
      }
      if (!response.ok) continue;
      const html = await response.text();
      if (html.length < 400 || /product not found/i.test(html)) continue;
      const og =
        html.match(/property=["']og:image["']\s+content=["']([^"']+)/i)?.[1] ||
        html.match(/content=["']([^"']+)["']\s+property=["']og:image["']/i)?.[1];
      const url = og ? absUrl(pageUrl, og) : null;
      if (url && looksLikeProductImage(url)) return url;
    } catch {
      // next
    }
  }
  return null;
}

async function lookupImageUrl(barcode: string): Promise<string | null> {
  const fromSpider = await lookupBarcodeSpider(barcode);
  if (fromSpider) return fromSpider;

  const fromBuycott = await lookupBuycott(barcode);
  if (fromBuycott) return fromBuycott;

  const fromUpc = await lookupUpcItemDb(barcode);
  if (fromUpc) return fromUpc;

  const fromGoUpc = await lookupGoUpc(barcode);
  if (fromGoUpc) return fromGoUpc;

  return null;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const databaseUrl = process.env.DATABASE_URL ?? "file:./prod-import.db";
  const dbPath = resolveDbPath(databaseUrl);
  const deadline = Date.now() + args.minutes * 60_000;

  console.log(`Database: ${dbPath}`);
  console.log(
    `Image lookup up to ${args.minutes} min, concurrency ${args.concurrency}`,
  );
  console.log(
    args.missingOnly
      ? "Mode: missing images only"
      : "Mode: missing + replace non-local remote images",
  );
  console.log(
    args.download
      ? "Store: download to /uploads"
      : "Store: remote CDN/image URL in DB",
  );
  if (args.dryRun) console.log("Dry run — no writes.");

  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");

  const sql = args.missingOnly
    ? `
      SELECT id, barcode, name, imagePath
      FROM Product
      WHERE imagePath IS NULL OR trim(imagePath) = ''
      ORDER BY length(barcode), barcode
    `
    : `
      SELECT id, barcode, name, imagePath
      FROM Product
      WHERE imagePath IS NULL OR trim(imagePath) = ''
         OR (imagePath NOT LIKE '/uploads/%' AND imagePath LIKE '%.200.%')
      ORDER BY
        CASE WHEN imagePath IS NULL OR trim(imagePath) = '' THEN 0 ELSE 1 END,
        barcode
    `;

  const candidates = db.prepare(sql).all() as Array<{
    id: string;
    barcode: string;
    name: string;
    imagePath: string | null;
  }>;
  const limited = args.limit > 0 ? candidates.slice(0, args.limit) : candidates;
  console.log(`Candidates: ${limited.length}`);

  const update = db.prepare(
    `UPDATE Product SET imagePath = ?, updatedAt = ? WHERE id = ?`,
  );

  let index = 0;
  let lookedUp = 0;
  let updated = 0;
  let missing = 0;
  let errors = 0;
  const examples: Array<{ barcode: string; name: string; image: string }> = [];

  async function worker() {
    while (Date.now() < deadline) {
      const current = index;
      index += 1;
      if (current >= limited.length) return;

      const row = limited[current];
      lookedUp += 1;
      try {
        const remote = await lookupImageUrl(row.barcode);
        if (!remote) {
          missing += 1;
        } else {
          let imagePath = remote;
          if (args.download && !args.dryRun) {
            const local = await saveRemoteProductImage(remote);
            if (local) imagePath = local;
          }
          if (!args.dryRun) {
            update.run(imagePath, new Date().toISOString(), row.id);
          }
          updated += 1;
          if (examples.length < 30) {
            examples.push({
              barcode: row.barcode,
              name: row.name.slice(0, 60),
              image: imagePath.slice(0, 120),
            });
          }
        }
      } catch {
        errors += 1;
      }

      if (lookedUp % 20 === 0) {
        const leftMin = Math.max(
          0,
          Math.round((deadline - Date.now()) / 60_000),
        );
        console.log(
          `... ${lookedUp}/${limited.length} looked up | updated ${updated} | missing ${missing} | errors ${errors} | ~${leftMin}m left`,
        );
      }

      await sleep(700);
    }
  }

  const workers = Array.from(
    { length: Math.max(1, args.concurrency) },
    () => worker(),
  );
  await Promise.all(workers);

  console.log("Done.", {
    lookedUp,
    updated,
    missing,
    errors,
    timedOut: Date.now() >= deadline && index < limited.length,
    remaining: Math.max(0, limited.length - index),
  });
  console.log("Examples:");
  for (const ex of examples) {
    console.log(`  ${ex.barcode} | ${ex.name}\n    ${ex.image}`);
  }
  db.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
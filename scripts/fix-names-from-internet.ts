/**
 * Live-fix dirty product names via non-OFF barcode sources:
 * - Barcode Lookup API (barcodelookup.com) when BARCODELOOKUP_API_KEY is set
 * - Barcode Spider public pages
 * - Buycott public product pages
 * - UPCitemdb trial API (100/day)
 * - Go-UPC public product pages
 *
 *   npx tsx scripts/fix-names-from-internet.ts
 *   npx tsx scripts/fix-names-from-internet.ts --minutes 55 --concurrency 2
 *   npx tsx scripts/fix-names-from-internet.ts --limit 50 --dry-run
 *   npx tsx scripts/fix-names-from-internet.ts --rollback-spam
 *   npx tsx scripts/fix-names-from-internet.ts --rollback-spam --dry-run
 */
import "dotenv/config";
import path from "node:path";
import Database from "better-sqlite3";
import fs from "node:fs";
import {
  cleanProductName,
  isAcceptableInternetProductName,
  isLowQualityProductName,
  pickBestProductName,
} from "../src/lib/product-name";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

type Args = {
  minutes: number;
  concurrency: number;
  dryRun: boolean;
  limit: number;
  rollbackSpam: boolean;
};

function parseArgs(argv: string[]): Args {
  const args: Args = {
    minutes: 55,
    concurrency: 2,
    dryRun: false,
    limit: 0,
    rollbackSpam: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--dry-run") args.dryRun = true;
    else if (argv[i] === "--rollback-spam") args.rollbackSpam = true;
    else if (argv[i] === "--minutes") args.minutes = Number(argv[++i] ?? "55");
    else if (argv[i] === "--concurrency")
      args.concurrency = Number(argv[++i] ?? "2");
    else if (argv[i] === "--limit") args.limit = Number(argv[++i] ?? "0");
  }
  return args;
}

function changeLogPath(): string {
  return path.join(process.cwd(), "data", "fix-names-changes.jsonl");
}

function appendChangeLog(entry: Record<string, unknown>): void {
  const file = changeLogPath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.appendFileSync(file, JSON.stringify(entry) + "\n", "utf8");
}

function resolveDbPath(databaseUrl: string): string {
  const raw = databaseUrl.replace(/^file:/, "");
  if (path.isAbsolute(raw)) return raw;
  return path.join(process.cwd(), raw);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isDirtyName(name: string): boolean {
  const n = name || "";
  if (!n.trim() || n.trim().length < 2) return true;
  if (/^[!#"']/.test(n.trim())) return true;
  if (/(?:&quot;|&amp;|&gt;|Prodhead)/i.test(n)) return true;
  if (/^\d+[A-Za-z]/.test(n.trim())) return true;
  if (isLowQualityProductName(n)) return true;
  const cleaned = cleanProductName(n);
  if (cleaned && cleaned !== n) return true;
  return false;
}

function score(name: string): number {
  const cleaned = cleanProductName(name);
  if (!cleaned) return -1000;
  let s = Math.min(cleaned.length, 100);
  if (isLowQualityProductName(cleaned)) s -= 60;
  if (/^[!#"']/.test(name.trim())) s -= 30;
  if (/(?:&quot;|&amp;|&gt;)/i.test(name)) s -= 20;
  if (/[a-z]/.test(cleaned) && /[A-Z]/.test(cleaned)) s += 8;
  if (/[\u0400-\u04FF]/.test(cleaned)) s += 10;
  return s;
}

function normalizeDigits(barcode: string): string {
  return String(barcode || "").replace(/\D/g, "").replace(/^0+/, "") || "0";
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

function significantTokens(name: string): string[] {
  const cleaned = cleanProductName(name).toLowerCase();
  return cleaned
    .split(/[^a-z0-9\u0400-\u04ff]+/i)
    .map((t) => t.trim())
    .filter((t) => t.length >= 4)
    .filter(
      (t) =>
        !["with", "from", "free", "pack", "size", "brand", "product"].includes(
          t,
        ),
    );
}

function namesCompatible(current: string, remote: string): boolean {
  const currentTokens = significantTokens(current);
  if (currentTokens.length === 0) return false;
  const remoteLower = cleanProductName(remote).toLowerCase();
  const hits = currentTokens.filter((t) => remoteLower.includes(t));
  if (currentTokens.length <= 2) return hits.length >= 1;
  return hits.length >= Math.min(2, Math.ceil(currentTokens.length / 3));
}

/** Accept remote only when quality is good; junk locals need short clean titles. */
function shouldAcceptRemote(current: string, remote: string): boolean {
  const cleaned = cleanProductName(remote);
  if (!isAcceptableInternetProductName(cleaned)) return false;
  if (score(cleaned) < 18) return false;

  const currentTokens = significantTokens(current);
  if (currentTokens.length === 0) {
    if (cleaned.length > 55) return false;
    if ((cleaned.match(/,/g) || []).length >= 2) return false;
    if (/\b(pack of|fl oz|softgels?|tablet|family size)\b/i.test(cleaned)) {
      return cleaned.length <= 40;
    }
    return true;
  }
  return namesCompatible(current, cleaned);
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function scrubRemoteTitle(raw: string): string {
  return cleanProductName(
    raw
      .replace(/\s*\|?\s*Barcode Spider.*$/i, "")
      .replace(/\s*[-–|]\s*(UPC|EAN|GTIN).*$/i, "")
      .replace(/\s+/g, " ")
      .trim(),
  );
}

function pageMentionsBarcode(html: string, barcode: string): boolean {
  const variants = barcodeVariants(barcode);
  const norms = new Set(variants.map(normalizeDigits));
  for (const v of variants) {
    if (html.includes(v)) return true;
  }
  for (const m of html.matchAll(/\b(\d{8,14})\b/g)) {
    if (norms.has(normalizeDigits(m[1]))) return true;
  }
  return false;
}

let goUpcCooldownUntil = 0;
let upcItemDbCooldownUntil = 0;

async function lookupBarcodeLookup(barcode: string): Promise<string | null> {
  const key = process.env.BARCODELOOKUP_API_KEY?.trim();
  if (!key) return null;

  for (const code of barcodeVariants(barcode)) {
    try {
      const url = new URL("https://api.barcodelookup.com/v3/products");
      url.searchParams.set("barcode", code);
      url.searchParams.set("key", key);
      const response = await fetch(url, {
        headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
        signal: AbortSignal.timeout(12000),
      });
      if (response.status === 404) continue;
      if (!response.ok) continue;
      const data = (await response.json()) as {
        products?: Array<{ product_name?: string; title?: string }>;
      };
      const product = data.products?.[0];
      const name = pickBestProductName([
        product?.product_name,
        product?.title,
      ]);
      if (name) return name;
    } catch {
      // next
    }
  }
  return null;
}

async function lookupBarcodeSpider(barcode: string): Promise<string | null> {
  for (const code of barcodeVariants(barcode)) {
    try {
      const response = await fetch(`https://www.barcodespider.com/${code}`, {
        headers: { "User-Agent": USER_AGENT, Accept: "text/html" },
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) continue;
      const html = await response.text();
      if (/product not found/i.test(html)) continue;
      const h1 = html.match(/<h1[^>]*>\s*([\s\S]*?)\s*<\/h1>/i)?.[1];
      const title = html.match(/<title>\s*([^<]+?)\s*<\/title>/i)?.[1];
      const name = scrubRemoteTitle(stripTags(h1 || title || ""));
      if (!name || /product not found/i.test(name)) continue;
      if (!pageMentionsBarcode(html, barcode) && !html.includes(code)) continue;
      return name;
    } catch {
      // next
    }
  }
  return null;
}


let buycottCooldownUntil = 0;

async function lookupBuycott(barcode: string): Promise<string | null> {
  if (Date.now() < buycottCooldownUntil) return null;

  for (const code of barcodeVariants(barcode)) {
    try {
      const response = await fetch(`https://www.buycott.com/upc/${code}`, {
        headers: { "User-Agent": USER_AGENT, Accept: "text/html" },
        signal: AbortSignal.timeout(15000),
      });
      if (response.status === 429) {
        buycottCooldownUntil = Date.now() + 120_000;
        console.log("buycott rate limited — cooling down 120s");
        return null;
      }
      if (response.status === 404) continue;
      if (!response.ok) continue;
      const html = await response.text();
      if (/no products found|product not found/i.test(html)) continue;
      const og = html.match(/property=["']og:title["']\s+content=["']([^"']+)/i)?.[1];
      const h2 = html.match(/<h2[^>]*>\s*([\s\S]*?)\s*<\/h2>/i)?.[1];
      const name = scrubRemoteTitle(stripTags(og || h2 || ""));
      if (!name || /^buycott$/i.test(name)) continue;
      if (!pageMentionsBarcode(html, barcode) && !html.includes(code)) continue;
      return name;
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
      const response = await fetch(
        `https://go-upc.com/search?q=${encodeURIComponent(code)}`,
        {
          headers: { "User-Agent": USER_AGENT, Accept: "text/html" },
          signal: AbortSignal.timeout(15000),
        },
      );
      if (response.status === 429) {
        goUpcCooldownUntil = Date.now() + 90_000;
        console.log("go-upc rate limited — cooling down 90s");
        return null;
      }
      if (response.status === 400 || response.status === 404) continue;
      if (!response.ok) continue;
      const html = await response.text();
      if (html.length < 400) continue;
      if (/product not found|no product found/i.test(html)) continue;
      if (!pageMentionsBarcode(html, barcode)) continue;
      const h1 = html.match(/<h1[^>]*>\s*([\s\S]*?)\s*<\/h1>/i)?.[1];
      if (!h1) continue;
      const name = scrubRemoteTitle(stripTags(h1));
      if (
        name &&
        !/^go-?upc$/i.test(name) &&
        !/search results/i.test(name) &&
        name.length >= 2
      ) {
        return name;
      }
    } catch {
      // next
    }
  }
  return null;
}

async function lookupUpcItemDb(barcode: string): Promise<string | null> {
  if (Date.now() < upcItemDbCooldownUntil) return null;

  for (const code of barcodeVariants(barcode)) {
    try {
      const response = await fetch(
        `https://api.upcitemdb.com/prod/trial/lookup?upc=${encodeURIComponent(code)}`,
        {
          headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
          signal: AbortSignal.timeout(12000),
        },
      );
      if (response.status === 429) {
        upcItemDbCooldownUntil = Date.now() + 45_000;
        console.log("upcitemdb rate limited — cooling down 45s");
        return null;
      }
      if (response.status === 400 || response.status === 404) continue;
      if (!response.ok) continue;
      const data = (await response.json()) as {
        items?: Array<{
          title?: string;
          brand?: string;
          ean?: string;
          upc?: string;
        }>;
      };
      const item = data.items?.[0];
      if (!item) continue;
      const itemCode = normalizeDigits(item.ean || item.upc || code);
      if (itemCode !== normalizeDigits(barcode)) continue;
      const name = pickBestProductName([item.title, item.brand]);
      if (name) return name;
    } catch {
      // next
    }
  }
  return null;
}

async function lookupName(
  barcode: string,
  currentName: string,
): Promise<string | null> {
  const candidates: string[] = [];

  const fromBarcodeLookup = await lookupBarcodeLookup(barcode);
  if (fromBarcodeLookup) candidates.push(fromBarcodeLookup);

  const fromSpider = await lookupBarcodeSpider(barcode);
  if (fromSpider) candidates.push(fromSpider);

  // Secondary free sources when spider misses.
  if (candidates.length === 0) {
    const fromBuycott = await lookupBuycott(barcode);
    if (fromBuycott) candidates.push(fromBuycott);
  }
  if (candidates.length === 0) {
    const fromUpcItemDb = await lookupUpcItemDb(barcode);
    if (fromUpcItemDb) candidates.push(fromUpcItemDb);
  }
  if (candidates.length === 0) {
    const fromGoUpc = await lookupGoUpc(barcode);
    if (fromGoUpc) candidates.push(fromGoUpc);
  }

  const acceptable = candidates.filter((c) =>
    shouldAcceptRemote(currentName, c),
  );
  return pickBestProductName(acceptable) || null;
}


/** Barcodes from the first loose internet-name run that got spam/wrong titles. */
const KNOWN_BAD_INTERNET_UPDATE_BARCODES = new Set([
  "3286018000257",
  "0789797097034",
  "4820181420437",
  "0633911616277",
  "13075101",
  "0180127000036",
  "8850025071101",
  "0096002009721",
  "4902388039749",
  "4902820112405",
  "0038257511970",
  "0075707098155",
  "8000500289495",
  "4620004250124",
  "0038000267406",
  "4760062102529",
  "0037000393009",
  "8801055706433",
  "0046500029448",
  "0048789111722",
  "0786162001528",
  "7613031513611",
  "8697926007262",
  "5391523529761",
  "0190198893376",
  "0032134255124",
  "9556001297921",
  "0022644003926",
  "0899101002026",
  "8906010277666",
  "4902179020246",
  "8885012290401",
  "0056100082040",
  "0620554005704",
  "0828158100287",
  "8717700001009",
  "87177756",
  "8846000010036",
  "0840006677673",
  "4250947570333",
]);


/** Very strong spam only — safe for catalog-wide rollback (not collector tins etc.). */
function isStrongRollbackSpamName(name: string): boolean {
  const cleaned = cleanProductName(name);
  if (!cleaned) return false;
  if (/\bunused\b/i.test(cleaned)) return true;
  if (
    /\bempty\b/i.test(cleaned) &&
    /\b(bottle|bottles|can|cans|vodka|cola)\b/i.test(cleaned)
  ) {
    return true;
  }
  if (/\buk\s*import\b|\bacc\s*new\b|\bbrand\s*new\s*in\s*box\b/i.test(cleaned)) {
    return true;
  }
  if (
    /\b(end\s*mill|mud\s*flap|capture\s*card|carton\s*cutter|replacement\s*blades)\b/i.test(
      cleaned,
    )
  ) {
    return true;
  }
  if (/\bcan\s+from\b/i.test(cleaned) && /\b(ml|litre|liter)\b/i.test(cleaned)) {
    return true;
  }
  if (
    /\b(new-warheads|wsf-tools|elgato|genuine\s+volkswagen)\b/i.test(
      cleaned.toLowerCase(),
    )
  ) {
    return true;
  }
  if (/\b(inscribed|бутылки|пляшка)\b/i.test(cleaned)) return true;
  return false;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const databaseUrl = process.env.DATABASE_URL ?? "file:./prod-import.db";
  const dbPath = resolveDbPath(databaseUrl);
  const deadline = Date.now() + args.minutes * 60_000;

  console.log(`Database: ${dbPath}`);
  if (args.rollbackSpam) {
    const db = new Database(dbPath);
    const rows = db
      .prepare(`SELECT id, barcode, name FROM Product`)
      .all() as Array<{ id: string; barcode: string; name: string }>;
    const update = db.prepare(
      `UPDATE Product SET name = ?, updatedAt = ? WHERE id = ?`,
    );
    let cleared = 0;
    const examples: Array<{ barcode: string; before: string }> = [];
    for (const row of rows) {
      const knownBad = KNOWN_BAD_INTERNET_UPDATE_BARCODES.has(row.barcode);
      if (!knownBad && !isStrongRollbackSpamName(row.name)) continue;
      if (!args.dryRun) {
        update.run("", new Date().toISOString(), row.id);
        appendChangeLog({
          action: "rollback-spam",
          id: row.id,
          barcode: row.barcode,
          before: row.name,
          after: "",
          at: new Date().toISOString(),
        });
      }
      cleared += 1;
      if (examples.length < 30) {
        examples.push({ barcode: row.barcode, before: row.name });
      }
    }
    db.close();
    console.log(
      args.dryRun
        ? `Dry-run: would clear ${cleared} suspicious names`
        : `Cleared ${cleared} suspicious names`,
    );
    for (const ex of examples) {
      console.log(`  ${ex.barcode}\n    before: ${ex.before}`);
    }
    return;
  }
  console.log(
    `Live lookup up to ${args.minutes} min, concurrency ${args.concurrency}`,
  );
  console.log(
    process.env.BARCODELOOKUP_API_KEY
      ? "Barcode Lookup API: key present"
      : "Barcode Lookup API: no BARCODELOOKUP_API_KEY (barcodespider + buycott + upcitemdb + go-upc)",
  );
  if (args.dryRun) console.log("Dry run — no writes.");

  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");

  const candidates = db
    .prepare(
      `
      SELECT id, barcode, name
      FROM Product
      WHERE name GLOB '!*'
         OR name GLOB '#*'
         OR name GLOB '"*'
         OR name GLOB '''*'
         OR name LIKE '%&quot;%'
         OR name LIKE '%&amp;%'
         OR name LIKE '%&gt;%'
         OR name LIKE '%Prodhead%'
         OR length(trim(name)) < 3
         OR name GLOB '[0-9][A-Za-z]*'
         OR name GLOB '[0-9][0-9][A-Za-z]*'
         OR name LIKE '%,%,%'
      ORDER BY length(name), name
      `,
    )
    .all() as Array<{ id: string; barcode: string; name: string }>;

  const queue = candidates.filter((row) => isDirtyName(row.name));
  const limited = args.limit > 0 ? queue.slice(0, args.limit) : queue;

  console.log(`Dirty candidates: ${limited.length}`);

  const update = db.prepare(
    `UPDATE Product SET name = ?, updatedAt = ? WHERE id = ?`,
  );

  let index = 0;
  let lookedUp = 0;
  let updated = 0;
  let unchanged = 0;
  let missing = 0;
  let errors = 0;
  const examples: Array<{ barcode: string; before: string; after: string }> =
    [];

  async function worker() {
    while (Date.now() < deadline) {
      const current = index;
      index += 1;
      if (current >= limited.length) return;

      const row = limited[current];
      lookedUp += 1;
      try {
        const remote = await lookupName(row.barcode, row.name);
        if (!remote) {
          missing += 1;
        } else if (
          remote !== row.name &&
          shouldAcceptRemote(row.name, remote) &&
          score(remote) > score(row.name)
        ) {
          const chosen = cleanProductName(remote);
          if (!args.dryRun) {
            update.run(chosen, new Date().toISOString(), row.id);
            appendChangeLog({
              action: "update",
              id: row.id,
              barcode: row.barcode,
              before: row.name,
              after: chosen,
              at: new Date().toISOString(),
            });
          }
          updated += 1;
          if (examples.length < 40) {
            examples.push({
              barcode: row.barcode,
              before: row.name,
              after: chosen,
            });
          }
        } else {
          unchanged += 1;
        }
      } catch {
        errors += 1;
      }

      if (lookedUp % 25 === 0) {
        const leftMin = Math.max(
          0,
          Math.round((deadline - Date.now()) / 60_000),
        );
        console.log(
          `... ${lookedUp}/${limited.length} looked up | updated ${updated} | missing ${missing} | unchanged ${unchanged} | errors ${errors} | ~${leftMin}m left`,
        );
      }

      await sleep(550);
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
    unchanged,
    errors,
    timedOut: Date.now() >= deadline && index < limited.length,
    remaining: Math.max(0, limited.length - index),
  });
  console.log("Examples:");
  for (const ex of examples) {
    console.log(
      `  ${ex.barcode}\n    before: ${ex.before}\n    after:  ${ex.after}`,
    );
  }
  db.close();
}

const isDirectRun =
  process.argv[1] &&
  (process.argv[1].endsWith("fix-names-from-internet.ts") ||
    process.argv[1].endsWith("fix-names-from-internet.js"));

if (isDirectRun) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
/**
 * One-shot Zamboo catalog pull into the local DB.
 *
 *   npx tsx scripts/sync-zamboo-catalog.ts
 *   npx tsx scripts/sync-zamboo-catalog.ts --force
 */
import "dotenv/config";
import { syncZambooCatalogIfDue } from "../src/lib/zamboo/sync";

async function main() {
  const force = process.argv.includes("--force");
  const result = await syncZambooCatalogIfDue({ force });
  console.log(result);
  if (result.skipped && result.reason === "not_configured") {
    process.exitCode = 1;
  }
}

void main();

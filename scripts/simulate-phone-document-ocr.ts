/**
 * Simulate the phone Add-document path vs the CLI test path.
 *
 * Phone (old): saveDataUrl → extractDocumentRowsFromPath  (disk)
 * Phone (new): extractDocumentRows(dataUrl)               (memory)
 * CLI test:    extractDocumentRows(dataUrl from file)     (memory)
 *
 *   npx tsx scripts/simulate-phone-document-ocr.ts /root/doc-test.jpg
 */
import "dotenv/config";
import { readFile, unlink } from "node:fs/promises";
import path from "node:path";
import {
  extractDocumentRows,
  extractDocumentRowsFromPath,
  getDocumentAiStatus,
} from "../src/lib/document-ai";
import { resolveLocalUploadPath, saveDataUrl } from "../src/lib/upload";

async function main() {
  const imagePath = process.argv[2];
  if (!imagePath) {
    console.error(
      "Usage: npx tsx scripts/simulate-phone-document-ocr.ts <image-file>",
    );
    process.exit(1);
  }

  const status = getDocumentAiStatus();
  console.log("AI status:", status);
  if (!status.configured) {
    console.error("FAIL: GEMINI_API_KEY not configured");
    process.exit(1);
  }

  const abs = path.resolve(imagePath);
  const buffer = await readFile(abs);
  const ext = abs.split(".").pop()?.toLowerCase() || "jpg";
  const mime =
    ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
  const dataUrl = `data:${mime};base64,${buffer.toString("base64")}`;
  console.log(`Source: ${abs} (${buffer.length} bytes)`);
  console.log(`cwd: ${process.cwd()}`);

  // --- Path A: old phone flow (upload to disk, then parse path) ---
  console.log("\n=== A) Phone disk path (upload → parse imagePath) ===");
  let uploadedPath: string | null = null;
  try {
    uploadedPath = await saveDataUrl(dataUrl);
    console.log(`saved as ${uploadedPath}`);
    const resolved = resolveLocalUploadPath(uploadedPath);
    console.log(`resolved to ${resolved}`);
    if (!resolved) throw new Error("resolveLocalUploadPath returned null");
    const rowsA = await extractDocumentRowsFromPath(uploadedPath);
    console.log(`OK A: ${rowsA.length} rows`);
  } catch (error) {
    console.error(
      "FAIL A:",
      error instanceof Error ? error.message : error,
    );
  } finally {
    if (uploadedPath) {
      const resolved = resolveLocalUploadPath(uploadedPath);
      if (resolved) await unlink(resolved).catch(() => undefined);
    }
  }

  // --- Path B: new phone flow (dataUrl in parse body) ---
  console.log("\n=== B) Phone memory path (parse dataUrl) ===");
  try {
    const rowsB = await extractDocumentRows(dataUrl);
    console.log(`OK B: ${rowsB.length} rows`);
    console.log(JSON.stringify(rowsB.slice(0, 3), null, 2));
  } catch (error) {
    console.error(
      "FAIL B:",
      error instanceof Error ? error.message : error,
    );
    process.exit(1);
  }
}

main();

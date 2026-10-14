/**
 * Test document OCR against a local image using server .env.
 *
 *   npx tsx scripts/test-document-ocr.ts /path/to/photo.jpg
 */
import "dotenv/config";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { extractDocumentRows, getDocumentAiStatus } from "../src/lib/document-ai";

async function main() {
  const imagePath = process.argv[2];
  if (!imagePath) {
    console.error("Usage: npx tsx scripts/test-document-ocr.ts <image-file>");
    process.exit(1);
  }

  const status = getDocumentAiStatus();
  console.log("AI status:", status);
  if (!status.configured) {
    console.error("FAIL: GEMINI_API_KEY / OPENAI_API_KEY not configured");
    process.exit(1);
  }

  const abs = path.resolve(imagePath);
  const buffer = await readFile(abs);
  const ext = abs.split(".").pop()?.toLowerCase() || "jpg";
  const mime =
    ext === "png"
      ? "image/png"
      : ext === "webp"
        ? "image/webp"
        : "image/jpeg";
  const dataUrl = `data:${mime};base64,${buffer.toString("base64")}`;
  console.log(`Image: ${abs} (${buffer.length} bytes, ${mime})`);
  console.log("Calling extractDocumentRows...");

  try {
    const rows = await extractDocumentRows(dataUrl);
    console.log(`OK: ${rows.length} rows`);
    console.log(JSON.stringify(rows.slice(0, 5), null, 2));
    if (rows.length > 5) console.log(`... and ${rows.length - 5} more`);
  } catch (error) {
    console.error("FAIL:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();

import { readFile } from "node:fs/promises";
import "dotenv/config";
import { z } from "zod";
import { sanitizeDocumentRows } from "@/lib/document-row-sanitize";
import { resolveLocalUploadPath } from "@/lib/upload";

const rowSchema = z.object({
  name: z.string().optional().nullable(),
  barcode: z.string().optional().nullable(),
  articul: z.string().optional().nullable(),
  expiryDate: z.string().optional().nullable(),
  /** Exact Godnost cell as printed, e.g. "01.12.2027" (day.month.year). */
  expiryPrinted: z.string().optional().nullable(),
  quantity: z.union([z.number(), z.string()]).optional().nullable(),
});

const rowsSchema = z.object({
  items: z.array(rowSchema),
});

export type DocumentOcrRow = {
  name: string;
  barcode: string | null;
  articul: string | null;
  expiryYmd: string | null;
  quantity: number;
};

function stripDataUrl(dataUrl: string): { mime: string; base64: string } {
  const match = /^data:([^;]+);base64,([\s\S]+)$/.exec(dataUrl.trim());
  if (!match) {
    throw new Error("INVALID_IMAGE");
  }
  return { mime: match[1], base64: match[2] };
}

function isValidCalendarYmd(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  if (year < 2000 || year > 2100) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

/** Parse common EU/BG date strings into YYYY-MM-DD. */
export function parseDocumentExpiry(value: string | null | undefined): string | null {
  if (!value) return null;
  const raw = value.trim();
  if (!raw) return null;

  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (iso) {
    const year = Number(iso[1]);
    const month = Number(iso[2]);
    const day = Number(iso[3]);
    if (!isValidCalendarYmd(year, month, day)) return null;
    return `${iso[1]}-${iso[2]}-${iso[3]}`;
  }

  // Bulgarian / EU documents use day.month.year (not US month/day).
  // Allow trailing lot/batch text, e.g. "23.06.2027 L268623".
  const dmy = /^(\d{1,2})[./\-](\d{1,2})[./\-](\d{2,4})(?:\s+.*)?$/.exec(raw);
  if (dmy) {
    const day = Number(dmy[1]);
    const month = Number(dmy[2]);
    let year = Number(dmy[3]);
    if (year < 100) year += 2000;
    if (!isValidCalendarYmd(year, month, day)) return null;
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  // ISO date with optional trailing lot text.
  const isoLoose = /^(\d{4})-(\d{2})-(\d{2})(?:\s+.*)?$/.exec(raw);
  if (isoLoose) {
    const year = Number(isoLoose[1]);
    const month = Number(isoLoose[2]);
    const day = Number(isoLoose[3]);
    if (!isValidCalendarYmd(year, month, day)) return null;
    return `${isoLoose[1]}-${isoLoose[2]}-${isoLoose[3]}`;
  }

  return null;
}


/** Parse ONLY day.month.year (Bulgarian documents). Never treat as US month/day or ISO. */
export function parsePrintedExpiry(value: string | null | undefined): string | null {
  if (!value) return null;
  const raw = value.trim();
  if (!raw) return null;

  // Reject ISO-shaped values in the printed field - those belong in expiryDate.
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return null;

  const dmy = /^(\d{1,2})[.\/\-](\d{1,2})[.\/\-](\d{2,4})(?:\s+.*)?$/.exec(raw);
  if (!dmy) return null;
  const day = Number(dmy[1]);
  const month = Number(dmy[2]);
  let year = Number(dmy[3]);
  if (year < 100) year += 2000;
  if (!isValidCalendarYmd(year, month, day)) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * Prefer the printed DD.MM.YYYY cell (source of truth) over model ISO,
 * which often swaps day/month (01.12 -> 2027-01-12 instead of 2027-12-01).
 */
export function resolveDocumentExpiry(
  expiryDate: string | null | undefined,
  expiryPrinted?: string | null | undefined,
): string | null {
  const fromPrinted = parsePrintedExpiry(expiryPrinted);
  if (fromPrinted) return fromPrinted;
  // Fallback only when the model failed to copy printed text.
  return parseDocumentExpiry(expiryDate);
}

function normalizeQuantity(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    const rounded = Math.round(value);
    return rounded >= 1 ? rounded : 1;
  }
  if (typeof value === "string") {
    const match = value.replace(",", ".").match(/\d+(\.\d+)?/);
    if (match) {
      const n = Math.round(Number(match[0]));
      return n >= 1 ? n : 1;
    }
  }
  return 1;
}

function tryParseJson(text: string): unknown {
  return JSON.parse(text);
}

/** Recover rows when the model truncates mid-array (common on long tables). */
export function repairTruncatedItemsJson(raw: string): string | null {
  const itemsKey = raw.indexOf('"items"');
  if (itemsKey < 0) return null;
  const arrayStart = raw.indexOf("[", itemsKey);
  if (arrayStart < 0) return null;

  let lastCompleteObjectEnd = -1;
  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = arrayStart + 1; i < raw.length; i += 1) {
    const ch = raw[i];
    if (inString) {
      if (escape) {
        escape = false;
      } else if (ch === "\\") {
        escape = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) lastCompleteObjectEnd = i;
    } else if (ch === "]" && depth === 0) {
      // End of the array. We have all complete objects; reconstruct a valid
      // wrapper (the model sometimes omits the closing root brace).
      break;
    }
  }

  if (lastCompleteObjectEnd < 0) return null;
  return `{"items":${raw.slice(arrayStart, lastCompleteObjectEnd + 1)}]}`;
}

function extractJsonObject(text: string): unknown {
  const trimmed = text.trim();
  const fenced = /^```(?:json)?\s*([\s\S]*?)```$/i.exec(trimmed);
  const body = fenced ? fenced[1].trim() : trimmed;
  const start = body.indexOf("{");
  if (start < 0) {
    throw new Error("OCR_PARSE_FAILED");
  }

  const slice = body.slice(start);
  const attempts = [slice];
  const end = slice.lastIndexOf("}");
  if (end > 0) attempts.push(slice.slice(0, end + 1));
  const repaired = repairTruncatedItemsJson(slice);
  if (repaired) attempts.push(repaired);

  let lastError: unknown;
  for (const candidate of attempts) {
    try {
      return tryParseJson(candidate);
    } catch (error) {
      lastError = error;
    }
  }

  console.error(
    "document AI JSON parse failed",
    lastError instanceof Error ? lastError.message : lastError,
  );
  if (process.env.OCR_DEBUG) {
    console.error("OCR_DEBUG rawLength", body.length);
    console.error("OCR_DEBUG head", body.slice(0, 300));
    console.error("OCR_DEBUG tail", body.slice(-300));
  }
  throw new Error("OCR_PARSE_FAILED");
}

function toRows(payload: unknown): DocumentOcrRow[] {
  const parsed = rowsSchema.safeParse(payload);
  if (!parsed.success) {
    throw new Error("OCR_PARSE_FAILED");
  }

  const rows = parsed.data.items
    .map((item) => {
      const name = item.name?.trim() ?? "";
      const barcode = item.barcode?.trim() || null;
      const articul = item.articul?.trim() || null;
      const expiryYmd = resolveDocumentExpiry(item.expiryDate, item.expiryPrinted);
      const quantity = normalizeQuantity(item.quantity);
      return { name, barcode, articul, expiryYmd, quantity };
    })
    .filter((row) => row.name || row.barcode || row.articul || row.expiryYmd);

  if (process.env.OCR_DEBUG === "1") {
    console.log(
      "OCR_DEBUG raw model items:",
      JSON.stringify(
        parsed.data.items.map((item) => ({
          name: item.name,
          articul: item.articul,
          quantity: item.quantity,
          expiryPrinted: item.expiryPrinted,
          expiryDate: item.expiryDate,
        })),
        null,
        2,
      ),
    );
    console.log(
      "OCR_DEBUG rows before sanitize:",
      JSON.stringify(
        rows.map((row) => ({
          name: row.name,
          articul: row.articul,
          quantity: row.quantity,
          expiryYmd: row.expiryYmd,
        })),
        null,
        2,
      ),
    );
  }

  const sanitized = sanitizeDocumentRows(rows);

  if (process.env.OCR_DEBUG === "1") {
    console.log(
      "OCR_DEBUG rows after sanitize:",
      JSON.stringify(
        sanitized.map((row) => ({
          name: row.name,
          articul: row.articul,
          quantity: row.quantity,
          expiryYmd: row.expiryYmd,
        })),
        null,
        2,
      ),
    );
  }

  return sanitized;
}

const SYSTEM_PROMPT = `Extract product lines from a photo of a Bulgarian store document (delivery note / izpisvane / expiry list / invoice).

Return ONLY compact JSON:
{"items":[{"name":"...","barcode":null,"articul":"...","expiryPrinted":"DD.MM.YYYY","expiryDate":null,"quantity":1}]}

#1 FAILURE TO AVOID — COLUMN ZIP / ROW SHIFT (most common):
Never read a whole column of names, then a whole column of dates, then zip them.
For EACH product, look at ONE horizontal band of the table and copy ONLY the cells that belong to that band:
  name + articul + quantity + Godnost (+ barcode if present) → one JSON object → next product.
If Godnost on a band is blank/unreadable → expiryPrinted null for THAT item only. Do not borrow the date from the band above or below.
A lone "1" in/near the Godnost column is NOT a date — use expiryPrinted null (never "1").
Whole-column shift symptoms (never do this):
- every item gets the NEXT row's date and the last item has null (dates too high), or
- a product's real DD.MM.YYYY is written on the row BELOW it and that product has null (dates too low).

ROW SEPARATOR LINES (optional — only when printed):
- Some tables draw a horizontal ruling line between product rows; many pages have none. Do not invent lines.
- WHEN a full horizontal separator IS visible between two text bands: treat bands above and below as separate products (never one wrap), even if names/articuls match; each keeps its own qty/Godnost.
- WHEN there are no separator lines: still split products by normal table row alignment (one horizontal band of cells → one item). Wrapped name lines without a line between them stay one product.

WRAPPED NAMES (one product, two text lines — only when no separator line between them):
  "АЕА КРАНЦХ Krekeri пълнозърнести зехтин и"
  "сусам, 160г"
→ ONE item: name joins both lines; qty/Godnost from that product's column cells (usually on the first name line).
Do not emit "сусам, 160г" as its own product.
If a printed horizontal separator sits between those two text lines, they are NOT a wrap — two products.

DUPLICATE NAMES (normal on warehouse lists — do NOT "fix"):
- The SAME product name (and often the same articul) can appear on TWO OR MORE consecutive table rows — different quantity and/or Godnost batches.
- Example: two lines both "Maggi 3 Минути … 12гр" / articul 900001261 — emit TWO items; each keeps its own quantity and expiryPrinted from its own band.
- Never merge those into one item. Never copy the second row's date onto the first (or vice versa). Never invent a phantom third copy.
- Same name + blank Godnost on row A and a real date on row B is valid — output both as printed.

DATES:
- Godnost is always DD.MM.YYYY (day first). Copy expiryPrinted exactly as printed (lot text after the date is OK).
- expiryDate must always be null (server converts).
- Never invent a date. Never swap day/month.
- Same Godnost on two neighboring products is allowed when both cells really show that date.

OTHER:
- Extract every real product on the page. Keep Cyrillic names.
- NAMES — copy EXACTLY as printed (literal transcript):
  - Do NOT expand abbreviations (e.g. keep "Негаз." — never rewrite as "Негазирана").
  - Do NOT transliterate or "fix" Latin ↔ Cyrillic lookalikes (keep "Max"/"Мах", "x"/"х", "гр"/"г" as on the page).
  - Do NOT add/remove spaces inside the printed name except joining a true wrapped name line.
- articul = SKU; barcode = EAN only; never swap them.
- quantity = pieces if printed, else 1.
- Ignore headers, addresses, totals, signatures.
- Page-edge cut-off crumbs (1–2 words with no columns): omit; do not attach a neighbor's qty/date.
- Final check: for the last 3 items, confirm each name still matches the Godnost printed on its own band.`;

// gemini-3.5-flash is deprecated (Google auto-routes it to 3.6) — call 3.6 by name.
const DEFAULT_GEMINI_MODEL = "gemini-3.6-flash";
const DEFAULT_OPENAI_MODEL = "gpt-4o-mini";

/**
 * Tried in order when the preferred model is busy / unavailable.
 * Prefer full Flash models before lite — lite causes many row/date shifts.
 */
const GEMINI_MODEL_FALLBACKS = [
  "gemini-3.6-flash",
  "gemini-3.8-flash",
  "gemini-3-flash-preview",
  "gemini-3.5-flash-lite",
  "gemini-3.1-flash-lite",
];

function resolveModel(
  raw: string | undefined,
  fallback: string,
): string {
  const model = raw?.trim() ?? "";
  // Reject broken .env values like: DOCUMENT_AI_MODEL=gemini 1.5 flash
  if (!model || /\s/.test(model)) return fallback;
  return model;
}

function geminiModelsToTry(preferred: string): string[] {
  const out: string[] = [];
  const push = (model: string) => {
    if (model && !out.includes(model)) out.push(model);
  };
  push(preferred);
  for (const model of GEMINI_MODEL_FALLBACKS) push(model);
  return out;
}

function documentAiConfigured(): {
  provider: "gemini" | "openai";
  apiKey: string;
  model: string;
} | null {
  const geminiKey = process.env.GEMINI_API_KEY?.trim();
  const openaiKey = process.env.OPENAI_API_KEY?.trim();
  const preferred = process.env.DOCUMENT_AI_PROVIDER?.trim().toLowerCase();

  if (preferred === "openai" && openaiKey) {
    return {
      provider: "openai",
      apiKey: openaiKey,
      model: resolveModel(process.env.DOCUMENT_AI_MODEL, DEFAULT_OPENAI_MODEL),
    };
  }
  if (preferred === "gemini" && geminiKey) {
    return {
      provider: "gemini",
      apiKey: geminiKey,
      model: resolveModel(process.env.DOCUMENT_AI_MODEL, DEFAULT_GEMINI_MODEL),
    };
  }
  if (geminiKey) {
    return {
      provider: "gemini",
      apiKey: geminiKey,
      model: resolveModel(process.env.DOCUMENT_AI_MODEL, DEFAULT_GEMINI_MODEL),
    };
  }
  if (openaiKey) {
    return {
      provider: "openai",
      apiKey: openaiKey,
      model: resolveModel(process.env.DOCUMENT_AI_MODEL, DEFAULT_OPENAI_MODEL),
    };
  }
  return null;
}

export function isDocumentAiConfigured(): boolean {
  return documentAiConfigured() !== null;
}

export function getDocumentAiStatus(): {
  configured: boolean;
  provider: string | null;
  model: string | null;
} {
  const config = documentAiConfigured();
  if (!config) {
    return { configured: false, provider: null, model: null };
  }
  return {
    configured: true,
    provider: config.provider,
    model: config.model,
  };
}

const PROVIDER_RETRY_DELAYS_MS = [1500, 4000];

/**
 * Cap silent Gemini hangs (Undici default headers timeout is ~300s).
 * Override with DOCUMENT_AI_FETCH_TIMEOUT_MS (ms, min 5s, max 180s).
 */
export const DEFAULT_DOCUMENT_AI_FETCH_TIMEOUT_MS = 40_000;

export function documentAiFetchTimeoutMs(): number {
  const raw = process.env.DOCUMENT_AI_FETCH_TIMEOUT_MS?.trim();
  const parsed = raw ? Number(raw) : DEFAULT_DOCUMENT_AI_FETCH_TIMEOUT_MS;
  if (!Number.isFinite(parsed)) return DEFAULT_DOCUMENT_AI_FETCH_TIMEOUT_MS;
  return Math.min(180_000, Math.max(5_000, Math.floor(parsed)));
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

/** Model overloaded / 503 — retrying the same model rarely helps; switch immediately. */
export function isProviderHighDemandError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("high demand") ||
    lower.includes("overloaded") ||
    /^OCR_PROVIDER:503:/.test(message)
  );
}

/**
 * Gemini free-tier daily/minute caps (e.g. 20 req) — waiting a few seconds and
 * retrying the same model never helps. Only these errors trigger the 10m skip;
 * hangs / 503 / other failures do not put a model on cooldown.
 */
export function isGeminiFreeTierQuotaError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("free_tier") ||
    lower.includes("generate_content_free_tier")
  );
}

/** Parse "Please retry in 2h24m9s" from Gemini quota errors. */
export function parseGeminiRetryAfterMs(message: string): number | null {
  const match =
    /retry in\s+(?:(\d+)\s*h)?(?:\s*(\d+)\s*m)?(?:\s*(\d+)\s*s)?/i.exec(
      message,
    );
  if (!match) return null;
  const hours = Number(match[1] ?? 0);
  const minutes = Number(match[2] ?? 0);
  const seconds = Number(match[3] ?? 0);
  const ms = ((hours * 60 + minutes) * 60 + seconds) * 1000;
  return ms > 0 ? ms : null;
}

/** How long to skip a model after free_tier before trying it again. */
export const GEMINI_FREE_TIER_COOLDOWN_MS = 10 * 60 * 1000;

/** How long to skip a model after a hang/timeout before trying it again. */
export const GEMINI_HANG_TIMEOUT_COOLDOWN_MS = 5 * 60 * 1000;

type GeminiModelCooldown = {
  untilMs: number;
  reason: "free_tier" | "hang";
};

/** In-process: skip models after free_tier or hang for a short window. */
const geminiModelCooldown = new Map<string, GeminiModelCooldown>();

function markGeminiModelCooldown(
  model: string,
  delayMs: number,
  reason: GeminiModelCooldown["reason"],
  now = Date.now(),
): void {
  const untilMs = now + delayMs;
  const prev = geminiModelCooldown.get(model);
  if (!prev || untilMs > prev.untilMs) {
    geminiModelCooldown.set(model, { untilMs, reason });
  }
}

export function markGeminiModelFreeTierExhausted(
  model: string,
  _message?: string,
  now = Date.now(),
): void {
  // Fixed 10m — ignore Gemini's multi-hour retry-after so we re-probe Flash often.
  markGeminiModelCooldown(model, GEMINI_FREE_TIER_COOLDOWN_MS, "free_tier", now);
}

export function markGeminiModelHangTimeout(
  model: string,
  now = Date.now(),
): void {
  markGeminiModelCooldown(model, GEMINI_HANG_TIMEOUT_COOLDOWN_MS, "hang", now);
}

export function isGeminiModelCoolingDown(
  model: string,
  now = Date.now(),
): GeminiModelCooldown["reason"] | null {
  const entry = geminiModelCooldown.get(model);
  if (entry == null) return null;
  if (now >= entry.untilMs) {
    geminiModelCooldown.delete(model);
    return null;
  }
  return entry.reason;
}

export function clearGeminiFreeTierCooldownsForTests(): void {
  geminiModelCooldown.clear();
}

/** Hung fetch / AbortSignal timeout — do not retry the same model for another full wait. */
export function isProviderHangTimeoutError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    /^OCR_PROVIDER:504:/.test(message) ||
    lower.includes("headers timeout") ||
    lower.includes("und_err_headers_timeout") ||
    lower.includes("request timed out after")
  );
}

function isRetryableProviderError(message: string): boolean {
  if (isUnavailableModelError(message)) return false;
  if (message.startsWith("OCR_EMPTY:")) return false;
  // Free-tier exhausted: do not burn 1.5s+4s per model (client/proxy timeout).
  if (isGeminiFreeTierQuotaError(message)) return false;
  // Silent hang already waited DOCUMENT_AI_FETCH_TIMEOUT_MS — next model, not another try.
  if (isProviderHangTimeoutError(message)) return false;
  // 503 / high demand: next model immediately (same-model retry often hangs again).
  if (isProviderHighDemandError(message)) return false;

  const statusMatch = /^OCR_PROVIDER:(\d{3}):/.exec(message);
  if (statusMatch) {
    const status = Number(statusMatch[1]);
    if (status === 429 || status === 500 || status === 502) {
      return true;
    }
  }

  const lower = message.toLowerCase();
  return (
    lower.includes("resource_exhausted") ||
    lower.includes("rate limit") ||
    lower.includes("quota") ||
    lower.includes("too many requests") ||
    lower.includes("unavailable") ||
    lower.includes("try again") ||
    lower.includes("deadline exceeded") ||
    lower.includes("internal error")
  );
}

async function withProviderRetries<T>(
  label: string,
  fn: () => Promise<T>,
): Promise<T> {
  let lastError: Error | null = null;
  const delays = PROVIDER_RETRY_DELAYS_MS;
  const maxAttempts = delays.length + 1;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      lastError = err;
      const canRetry =
        attempt < delays.length && isRetryableProviderError(err.message);
      if (!canRetry) throw err;
      const delay = delays[attempt] ?? delays[delays.length - 1];
      console.warn(
        `document AI: ${label} retry ${attempt + 1}/${delays.length} in ${delay}ms (${err.message})`,
      );
      await sleep(delay);
    }
  }

  throw lastError ?? new Error("OCR_PROVIDER:Retries exhausted");
}

type GeminiThinkingLevel = "low" | "medium" | "high";

async function generateGeminiJsonOnce(input: {
  apiKey: string;
  model: string;
  parts: unknown[];
  maxOutputTokens: number;
  thinkingLevel?: GeminiThinkingLevel;
}): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(input.model)}:generateContent?key=${encodeURIComponent(input.apiKey)}`;

  // Gemini 2.5: thinkingBudget 0 unless a level is requested.
  // Gemini 3.x: thinkingLevel (OCR uses low; catalog match uses medium).
  const isGemini3 = /gemini-3/i.test(input.model);
  const isGemini25 = /gemini-2\.5/i.test(input.model);

  const generationConfig: Record<string, unknown> = {
    maxOutputTokens: input.maxOutputTokens,
    responseMimeType: "application/json",
    temperature: 0,
  };
  if (isGemini25) {
    generationConfig.thinkingConfig = input.thinkingLevel
      ? { thinkingBudget: input.thinkingLevel === "low" ? 0 : 1024 }
      : { thinkingBudget: 0 };
  } else if (isGemini3) {
    generationConfig.thinkingConfig = {
      thinkingLevel: input.thinkingLevel ?? "low",
    };
  }

  const timeoutMs = documentAiFetchTimeoutMs();
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(timeoutMs),
      body: JSON.stringify({
        contents: [{ role: "user", parts: input.parts }],
        generationConfig,
      }),
    });
  } catch (error) {
    throw mapFetchTimeoutError(error, timeoutMs);
  }

  const data = (await response.json().catch(() => null)) as {
    error?: { message?: string; status?: string };
    promptFeedback?: { blockReason?: string };
    candidates?: Array<{
      finishReason?: string;
      content?: {
        parts?: Array<{ text?: string; thought?: boolean }>;
      };
    }>;
  } | null;

  if (!response.ok) {
    const detail =
      data?.error?.message || data?.error?.status || "OCR_PROVIDER_ERROR";
    throw new Error(`OCR_PROVIDER:${response.status}:${detail}`);
  }

  if (data?.promptFeedback?.blockReason) {
    throw new Error(`OCR_EMPTY:BLOCKED_${data.promptFeedback.blockReason}`);
  }

  const candidate = data?.candidates?.[0];
  const text = candidate?.content?.parts
    ?.filter((part) => part.text && !part.thought)
    .map((part) => part.text ?? "")
    .join("\n")
    .trim();
  if (!text) {
    throw new Error(`OCR_EMPTY:${candidate?.finishReason || "EMPTY"}`);
  }
  return text;
}

function isUnavailableModelError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("not_found") ||
    lower.includes("not found") ||
    lower.includes("no longer available") ||
    lower.includes("is not found")
  );
}

/** Bad request for this model/config — try the next model in the cascade. */
function isInvalidArgumentError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    /^OCR_PROVIDER:400:/.test(message) ||
    lower.includes("invalid_argument") ||
    lower.includes("invalid argument")
  );
}

async function runGeminiCascade(
  apiKey: string,
  preferredModel: string,
  once: (model: string) => Promise<string>,
): Promise<string> {
  const models = geminiModelsToTry(preferredModel);
  let lastError: Error | null = null;
  let hangTimeouts = 0;

  for (const model of models) {
    const cooldownReason = isGeminiModelCoolingDown(model);
    if (cooldownReason) {
      console.warn(
        `document AI: model "${model}" skipped (${cooldownReason} cooldown)`,
      );
      continue;
    }

    const startedAt = Date.now();
    try {
      const text = await withProviderRetries(`gemini:${model}`, () =>
        once(model),
      );
      geminiModelCooldown.delete(model);
      console.log(
        `document AI: model "${model}" ok in ${Date.now() - startedAt}ms`,
      );
      if (model !== preferredModel) {
        console.warn(
          `document AI: preferred model "${preferredModel}" failed; used "${model}"`,
        );
      }
      return text;
    } catch (error) {
      console.warn(
        `document AI: model "${model}" failed in ${Date.now() - startedAt}ms`,
      );
      const message = error instanceof Error ? error.message : String(error);
      lastError = error instanceof Error ? error : new Error(message);
      if (isGeminiFreeTierQuotaError(message)) {
        markGeminiModelFreeTierExhausted(model, message);
        console.warn(
          `document AI: model "${model}" free-tier quota hit, trying next immediately`,
        );
        continue;
      }
      if (isProviderHighDemandError(message)) {
        console.warn(
          `document AI: model "${model}" high demand/503, trying next immediately`,
        );
        continue;
      }
      if (isProviderHangTimeoutError(message)) {
        hangTimeouts += 1;
        markGeminiModelHangTimeout(model);
        console.warn(
          `document AI: model "${model}" hung/timed out, trying next immediately`,
        );
        // Second silent hang in one scan ≈ another full timeout for nothing — stop.
        if (hangTimeouts >= 2) break;
        continue;
      }
      if (
        isUnavailableModelError(message) ||
        isInvalidArgumentError(message) ||
        message.startsWith("OCR_EMPTY:") ||
        isRetryableProviderError(message)
      ) {
        console.warn(
          `document AI: model "${model}" failed (${message}), trying next`,
        );
        continue;
      }
      throw lastError;
    }
  }

  console.warn(
    `document AI: cascade exhausted${lastError ? ` (${lastError.message})` : ""}`,
  );
  // Distinct code so the API can show a friendly "try again in 5 minutes".
  throw new Error("OCR_CASCADE_EXHAUSTED");
}

async function extractWithGemini(
  apiKey: string,
  preferredModel: string,
  mime: string,
  base64: string,
): Promise<string> {
  return runGeminiCascade(apiKey, preferredModel, (model) =>
    generateGeminiJsonOnce({
      apiKey,
      model,
      maxOutputTokens: 65536,
      thinkingLevel: "low",
      parts: [
        { text: SYSTEM_PROMPT },
        { inlineData: { mimeType: mime, data: base64 } },
      ],
    }),
  );
}

function mapFetchTimeoutError(error: unknown, timeoutMs: number): Error {
  const err = error instanceof Error ? error : new Error(String(error));
  const cause =
    err.cause instanceof Error
      ? err.cause.message
      : typeof err.cause === "string"
        ? err.cause
        : "";
  const blob = `${err.name} ${err.message} ${cause}`;
  if (
    err.name === "TimeoutError" ||
    err.name === "AbortError" ||
    /headers timeout|und_err_headers_timeout|aborted/i.test(blob)
  ) {
    return new Error(
      `OCR_PROVIDER:504:Request timed out after ${timeoutMs}ms`,
    );
  }
  return err;
}

async function extractWithOpenAI(
  apiKey: string,
  model: string,
  mime: string,
  base64: string,
): Promise<string> {
  const baseUrl =
    process.env.DOCUMENT_AI_BASE_URL?.trim().replace(/\/$/, "") ||
    "https://api.openai.com/v1";
  const timeoutMs = documentAiFetchTimeoutMs();
  let response: Response;
  try {
    response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      signal: AbortSignal.timeout(timeoutMs),
      body: JSON.stringify({
        model,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Extract all product rows from this document photo.",
              },
              {
                type: "image_url",
                image_url: { url: `data:${mime};base64,${base64}` },
              },
            ],
          },
        ],
      }),
    });
  } catch (error) {
    throw mapFetchTimeoutError(error, timeoutMs);
  }

  const data = (await response.json().catch(() => null)) as {
    error?: { message?: string };
    choices?: Array<{ message?: { content?: string } }>;
  } | null;

  if (!response.ok) {
    throw new Error(
      `OCR_PROVIDER:${response.status}:${data?.error?.message || "OCR_PROVIDER_ERROR"}`,
    );
  }

  const text = data?.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("OCR_EMPTY:EMPTY");
  return text;
}

async function completeWithOpenAIJson(
  apiKey: string,
  model: string,
  system: string,
  user: string,
): Promise<string> {
  const baseUrl =
    process.env.DOCUMENT_AI_BASE_URL?.trim().replace(/\/$/, "") ||
    "https://api.openai.com/v1";
  const timeoutMs = documentAiFetchTimeoutMs();
  let response: Response;
  try {
    response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      signal: AbortSignal.timeout(timeoutMs),
      body: JSON.stringify({
        model,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });
  } catch (error) {
    throw mapFetchTimeoutError(error, timeoutMs);
  }

  const data = (await response.json().catch(() => null)) as {
    error?: { message?: string };
    choices?: Array<{ message?: { content?: string } }>;
  } | null;

  if (!response.ok) {
    throw new Error(
      `OCR_PROVIDER:${response.status}:${data?.error?.message || "OCR_PROVIDER_ERROR"}`,
    );
  }

  const text = data?.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("OCR_EMPTY:EMPTY");
  return text;
}

export type DocumentAiJsonComplete = (input: {
  system: string;
  user: string;
}) => Promise<string>;

/** Text-only JSON completion on the same Gemini/OpenAI stack as document OCR. */
export async function completeDocumentAiJson(input: {
  system: string;
  user: string;
  maxOutputTokens?: number;
  thinkingLevel?: GeminiThinkingLevel;
}): Promise<string> {
  const config = documentAiConfigured();
  if (!config) {
    throw new Error("OCR_NOT_CONFIGURED");
  }

  if (config.provider === "openai") {
    return withProviderRetries(`openai:${config.model}`, () =>
      completeWithOpenAIJson(config.apiKey, config.model, input.system, input.user),
    );
  }

  return runGeminiCascade(config.apiKey, config.model, (model) =>
    generateGeminiJsonOnce({
      apiKey: config.apiKey,
      model,
      maxOutputTokens: input.maxOutputTokens ?? 8192,
      thinkingLevel: input.thinkingLevel ?? "medium",
      parts: [{ text: `${input.system}\n\n${input.user}` }],
    }),
  );
}

export async function extractDocumentRows(
  dataUrl: string,
): Promise<DocumentOcrRow[]> {
  const config = documentAiConfigured();
  if (!config) {
    throw new Error("OCR_NOT_CONFIGURED");
  }

  const { mime, base64 } = stripDataUrl(dataUrl);
  const text =
    config.provider === "gemini"
      ? await extractWithGemini(config.apiKey, config.model, mime, base64)
      : await withProviderRetries(`openai:${config.model}`, () =>
          extractWithOpenAI(config.apiKey, config.model, mime, base64),
        );

  return toRows(extractJsonObject(text));
}

export async function extractDocumentRowsFromPath(
  imagePath: string,
): Promise<DocumentOcrRow[]> {
  const filePath = resolveLocalUploadPath(imagePath);
  if (!filePath) {
    throw new Error("INVALID_IMAGE");
  }
  const buffer = await readFile(filePath);
  const ext = filePath.split(".").pop()?.toLowerCase() || "jpg";
  const mime =
    ext === "png"
      ? "image/png"
      : ext === "webp"
        ? "image/webp"
        : ext === "gif"
          ? "image/gif"
          : "image/jpeg";
  const dataUrl = `data:${mime};base64,${buffer.toString("base64")}`;
  return extractDocumentRows(dataUrl);
}
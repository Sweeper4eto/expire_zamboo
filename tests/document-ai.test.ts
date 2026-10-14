import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_DOCUMENT_AI_FETCH_TIMEOUT_MS,
  GEMINI_FREE_TIER_COOLDOWN_MS,
  GEMINI_HANG_TIMEOUT_COOLDOWN_MS,
  clearGeminiFreeTierCooldownsForTests,
  documentAiFetchTimeoutMs,
  isGeminiFreeTierQuotaError,
  isGeminiModelCoolingDown,
  isProviderHangTimeoutError,
  isProviderHighDemandError,
  markGeminiModelFreeTierExhausted,
  markGeminiModelHangTimeout,
  parseDocumentExpiry,
  parseGeminiRetryAfterMs,
  parsePrintedExpiry,
  repairTruncatedItemsJson,
  resolveDocumentExpiry,
} from "../src/lib/document-ai";

describe("isGeminiFreeTierQuotaError", () => {
  it("detects free-tier quota 429s that need hours, not seconds", () => {
    assert.equal(
      isGeminiFreeTierQuotaError(
        "OCR_PROVIDER:429:Quota exceeded for metric: generativelanguage.googleapis.com/generate_content_free_tier_requests, limit: 20, model: gemini-3.5-flash Please retry in 2h24m9s.",
      ),
      true,
    );
    assert.equal(
      isGeminiFreeTierQuotaError("OCR_PROVIDER:503:high demand"),
      false,
    );
    assert.equal(
      isGeminiFreeTierQuotaError(
        "OCR_PROVIDER:504:Request timed out after 40000ms",
      ),
      false,
    );
    // Generic retry hint alone is not free-tier depletion.
    assert.equal(
      isGeminiFreeTierQuotaError("OCR_PROVIDER:429:Please retry in 2h"),
      false,
    );
  });
});

describe("parseGeminiRetryAfterMs / free-tier cooldown", () => {
  it("parses retry-after durations from quota errors", () => {
    assert.equal(
      parseGeminiRetryAfterMs("Please retry in 2h24m9s."),
      ((2 * 60 + 24) * 60 + 9) * 1000,
    );
    assert.equal(parseGeminiRetryAfterMs("retry in 45m"), 45 * 60 * 1000);
    assert.equal(parseGeminiRetryAfterMs("no hint"), null);
  });

  it("skips models for 10 minutes after free-tier then retries", () => {
    clearGeminiFreeTierCooldownsForTests();
    const now = 1_000_000;
    markGeminiModelFreeTierExhausted(
      "gemini-3.5-flash",
      "Please retry in 2h24m9s.",
      now,
    );
    assert.equal(GEMINI_FREE_TIER_COOLDOWN_MS, 10 * 60 * 1000);
    assert.equal(
      isGeminiModelCoolingDown("gemini-3.5-flash", now + 1000),
      "free_tier",
    );
    assert.equal(
      isGeminiModelCoolingDown(
        "gemini-3.5-flash",
        now + GEMINI_FREE_TIER_COOLDOWN_MS,
      ),
      null,
    );
    clearGeminiFreeTierCooldownsForTests();
  });

  it("skips models for 5 minutes after hang timeout then retries", () => {
    clearGeminiFreeTierCooldownsForTests();
    const now = 1_000_000;
    markGeminiModelHangTimeout("gemini-3.5-flash-lite", now);
    assert.equal(GEMINI_HANG_TIMEOUT_COOLDOWN_MS, 5 * 60 * 1000);
    assert.equal(
      isGeminiModelCoolingDown("gemini-3.5-flash-lite", now + 1000),
      "hang",
    );
    assert.equal(
      isGeminiModelCoolingDown(
        "gemini-3.5-flash-lite",
        now + GEMINI_HANG_TIMEOUT_COOLDOWN_MS,
      ),
      null,
    );
    clearGeminiFreeTierCooldownsForTests();
  });
});

describe("isProviderHighDemandError", () => {
  it("detects 503 high demand so we skip same-model retry", () => {
    assert.equal(
      isProviderHighDemandError(
        "OCR_PROVIDER:503:This model is currently experiencing high demand. Spikes in demand are usually temporary. Please try again later.",
      ),
      true,
    );
    assert.equal(isProviderHighDemandError("OCR_PROVIDER:503:overloaded"), true);
    assert.equal(
      isProviderHighDemandError("OCR_PROVIDER:504:Request timed out after 40000ms"),
      false,
    );
  });
});

describe("isProviderHangTimeoutError", () => {
  it("detects our AbortSignal timeout and Undici headers timeout", () => {
    assert.equal(
      isProviderHangTimeoutError(
        "OCR_PROVIDER:504:Request timed out after 40000ms",
      ),
      true,
    );
    assert.equal(
      isProviderHangTimeoutError(
        "fetch failed: Headers Timeout Error UND_ERR_HEADERS_TIMEOUT",
      ),
      true,
    );
    assert.equal(
      isProviderHangTimeoutError("OCR_PROVIDER:503:high demand"),
      false,
    );
  });
});

describe("documentAiFetchTimeoutMs", () => {
  it("defaults to 40s and clamps env overrides", () => {
    const prev = process.env.DOCUMENT_AI_FETCH_TIMEOUT_MS;
    try {
      delete process.env.DOCUMENT_AI_FETCH_TIMEOUT_MS;
      assert.equal(documentAiFetchTimeoutMs(), DEFAULT_DOCUMENT_AI_FETCH_TIMEOUT_MS);
      process.env.DOCUMENT_AI_FETCH_TIMEOUT_MS = "1000";
      assert.equal(documentAiFetchTimeoutMs(), 5_000);
      process.env.DOCUMENT_AI_FETCH_TIMEOUT_MS = "999999";
      assert.equal(documentAiFetchTimeoutMs(), 180_000);
    } finally {
      if (prev === undefined) delete process.env.DOCUMENT_AI_FETCH_TIMEOUT_MS;
      else process.env.DOCUMENT_AI_FETCH_TIMEOUT_MS = prev;
    }
  });
});

describe("parseDocumentExpiry", () => {
  it("parses ISO dates", () => {
    assert.equal(parseDocumentExpiry("2026-07-18"), "2026-07-18");
  });

  it("parses DMY with dots", () => {
    assert.equal(parseDocumentExpiry("18.07.2026"), "2026-07-18");
  });

  it("parses DMY with slashes and short year", () => {
    assert.equal(parseDocumentExpiry("5/1/26"), "2026-01-05");
  });

  it("returns null for empty or invalid", () => {
    assert.equal(parseDocumentExpiry(""), null);
    assert.equal(parseDocumentExpiry("n/a"), null);
  });

  it("accepts date with trailing lot/batch text", () => {
    assert.equal(parseDocumentExpiry("23.06.2027 L268623"), "2027-06-23");
    assert.equal(parseDocumentExpiry("2027-06-23 L268623"), "2027-06-23");
  });

  it("rejects impossible calendar dates", () => {
    assert.equal(parseDocumentExpiry("31.02.2026"), null);
    assert.equal(parseDocumentExpiry("2026-02-31"), null);
  });
});

describe("resolveDocumentExpiry", () => {
  it("prefers printed DD.MM.YYYY over swapped ISO month/day", () => {
    // Model often emits US order ISO for Bulgarian 01.12.2027
    assert.equal(
      resolveDocumentExpiry("2027-01-12", "01.12.2027"),
      "2027-12-01",
    );
  });

  it("keeps January 12 when printed says 12.01", () => {
    assert.equal(
      resolveDocumentExpiry("2026-12-01", "12.01.2026"),
      "2026-01-12",
    );
  });

  it("falls back to ISO when printed is missing", () => {
    assert.equal(resolveDocumentExpiry("2027-12-01", null), "2027-12-01");
  });

  it("ignores ISO-shaped values in the printed field", () => {
    assert.equal(
      resolveDocumentExpiry("2027-12-01", "2027-01-12"),
      "2027-12-01",
    );
  });
});

describe("parsePrintedExpiry", () => {
  it("always reads day first", () => {
    assert.equal(parsePrintedExpiry("01.12.2027"), "2027-12-01");
    assert.equal(parsePrintedExpiry("12.01.2027"), "2027-01-12");
  });
});

describe("repairTruncatedItemsJson", () => {
  it("reconstructs when the closing root brace is missing", () => {
    const raw = '{\n"items":[{"name":"A"},{"name":"B"}]';
    const repaired = repairTruncatedItemsJson(raw);
    assert.ok(repaired);
    const parsed = JSON.parse(repaired!);
    assert.deepEqual(parsed.items, [{ name: "A" }, { name: "B" }]);
  });

  it("drops an incomplete trailing object", () => {
    const raw = '{"items":[{"name":"A"},{"name":"B"},{"name":"C';
    const repaired = repairTruncatedItemsJson(raw);
    assert.ok(repaired);
    const parsed = JSON.parse(repaired!);
    assert.deepEqual(parsed.items, [{ name: "A" }, { name: "B" }]);
  });

  it("returns null when there is no complete object", () => {
    assert.equal(repairTruncatedItemsJson('{"items":[{"name":"A'), null);
  });
});

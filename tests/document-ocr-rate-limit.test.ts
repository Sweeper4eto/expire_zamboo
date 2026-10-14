import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import {
  getDocumentOcrRetryAfterMs,
  resetDocumentOcrRateLimitsForTests,
  takeDocumentOcrSlot,
} from "../src/lib/document-ocr-rate-limit";

describe("document-ocr-rate-limit", () => {
  beforeEach(() => {
    resetDocumentOcrRateLimitsForTests();
  });

  it("allows 50 scans then blocks", () => {
    const userId = "user-a";
    for (let i = 0; i < 50; i += 1) {
      assert.equal(takeDocumentOcrSlot(userId), null);
    }
    const blocked = takeDocumentOcrSlot(userId);
    assert.notEqual(blocked, null);
    assert.ok((blocked as number) > 0);
    assert.ok(getDocumentOcrRetryAfterMs(userId) > 0);
  });

  it("tracks users separately", () => {
    for (let i = 0; i < 50; i += 1) {
      assert.equal(takeDocumentOcrSlot("user-a"), null);
    }
    assert.notEqual(takeDocumentOcrSlot("user-a"), null);
    assert.equal(takeDocumentOcrSlot("user-b"), null);
  });
});

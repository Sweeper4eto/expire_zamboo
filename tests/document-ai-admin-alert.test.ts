import assert from "node:assert/strict";
import test from "node:test";
import { shouldAlertDocumentAiFailure } from "../src/lib/document-ai-admin-alert";

test("shouldAlertDocumentAiFailure flags provider and config errors", () => {
  assert.equal(
    shouldAlertDocumentAiFailure(
      "OCR_PROVIDER:400:Request contains an invalid argument.",
    ),
    true,
  );
  assert.equal(shouldAlertDocumentAiFailure("OCR_NOT_CONFIGURED"), true);
  assert.equal(
    shouldAlertDocumentAiFailure("OCR_EMPTY:BLOCKED_SAFETY"),
    true,
  );
  assert.equal(shouldAlertDocumentAiFailure("OCR_EMPTY:EMPTY"), false);
  assert.equal(shouldAlertDocumentAiFailure("INVALID_IMAGE"), false);
  assert.equal(shouldAlertDocumentAiFailure("OCR_PARSE_FAILED"), false);
});

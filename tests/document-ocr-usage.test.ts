import test from "node:test";
import assert from "node:assert/strict";
import {
  documentOcrUsageDayKey,
  zonedLocalToUtc,
} from "../src/lib/document-ocr-usage";

const TZ = "Europe/Sofia";

test("OCR usage day key uses Europe/Sofia, not UTC", () => {
  // 02:25 Sofia on Mon 5 Oct 2026 = 23:25 UTC on Sun 4 Oct
  const nightScan = new Date("2026-10-04T23:25:00.000Z");
  assert.equal(documentOcrUsageDayKey(nightScan, TZ), "2026-10-05");
  assert.equal(nightScan.toISOString().slice(0, 10), "2026-10-04");
});

test("zonedLocalToUtc midnight Sofia is previous evening UTC in summer", () => {
  // EEST (UTC+3): Mon 5 Oct 00:00 Sofia = Sun 4 Oct 21:00 UTC
  const start = zonedLocalToUtc("2026-10-05", 0, 0, 0, 0, TZ);
  assert.equal(start.toISOString(), "2026-10-04T21:00:00.000Z");
  const end = zonedLocalToUtc("2026-10-05", 23, 59, 59, 999, TZ);
  assert.equal(end.toISOString(), "2026-10-05T20:59:59.999Z");
});

test("zonedLocalToUtc uses winter offset (EET, UTC+2)", () => {
  // 15 Jan 2026 is standard time in Sofia.
  const start = zonedLocalToUtc("2026-01-15", 0, 0, 0, 0, TZ);
  assert.equal(start.toISOString(), "2026-01-14T22:00:00.000Z");
  const nightScan = new Date("2026-01-14T23:30:00.000Z"); // 01:30 Sofia on 15 Jan
  assert.equal(documentOcrUsageDayKey(nightScan, TZ), "2026-01-15");
});

test("night scan falls inside Monday Sofia day bounds", () => {
  const from = zonedLocalToUtc("2026-10-05", 0, 0, 0, 0, TZ);
  const to = zonedLocalToUtc("2026-10-05", 23, 59, 59, 999, TZ);
  const nightScan = new Date("2026-10-04T23:25:00.000Z");
  assert.ok(nightScan >= from && nightScan <= to);
});

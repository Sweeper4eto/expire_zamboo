import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { buildScheduleWeekPrintHtml } from "../src/lib/schedule-week-print";

const labels = {
  title: "Weekly schedule",
  storeLabel: "Location",
  weekLabel: "Week",
  personColumn: "Person",
  fromColumn: "From",
  toColumn: "To",
  durationColumn: "Duration",
  noShifts: "No shifts",
  noSchedule: "Няма график",
  dayNames: [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
  ],
  hoursUnit: "h",
  minutesUnit: "m",
  printHint: "Print hint",
};

function daysWith(
  overrides: Partial<Record<number, "DRAFT" | "FINALIZED">> = {},
) {
  return [0, 1, 2, 3, 4, 5, 6].map((dayIndex) => ({
    dayIndex,
    status: overrides[dayIndex] ?? "DRAFT",
    excludedUserIds: [] as string[],
  }));
}

describe("schedule week print", () => {
  test("lists shifts only on finalized days", () => {
    const html = buildScheduleWeekPrintHtml({
      weekStart: "2026-09-28",
      storeName: "Main",
      staff: [
        { id: "a", username: "alice", displayName: "Alice A" },
        { id: "b", username: "bob" },
      ],
      shifts: [
        { userId: "a", dayIndex: 0, startMin: 7 * 60, endMin: 12 * 60 },
        { userId: "b", dayIndex: 5, startMin: 12 * 60, endMin: 18 * 60 },
      ],
      days: daysWith({ 0: "FINALIZED", 5: "DRAFT" }),
      labels,
    });
    assert.match(html, /Alice A/);
    assert.match(html, /07:00/);
    assert.doesNotMatch(html, />bob</);
    assert.match(html, /Няма график/);
  });

  test("skips excluded people on finalized days", () => {
    const days = daysWith({ 0: "FINALIZED" });
    days[0]!.excludedUserIds = ["b"];
    const html = buildScheduleWeekPrintHtml({
      weekStart: "2026-09-28",
      storeName: "Main",
      staff: [
        { id: "a", username: "alice", displayName: "Alice A" },
        { id: "b", username: "bob" },
      ],
      shifts: [
        { userId: "a", dayIndex: 0, startMin: 7 * 60, endMin: 12 * 60 },
        { userId: "b", dayIndex: 0, startMin: 12 * 60, endMin: 18 * 60 },
      ],
      days,
      labels,
    });
    assert.match(html, /Alice A/);
    assert.doesNotMatch(html, />bob</);
  });
});

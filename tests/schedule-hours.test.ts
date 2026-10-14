import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  autoFillDay,
  formatDurationMinutes,
  monthStartYmd,
  SCHEDULE_CLOSE_MIN,
  SCHEDULE_OPEN_MIN,
  SCHEDULE_SPAN_MIN,
  sumShiftMinutesInRange,
} from "../src/lib/schedule";

describe("schedule month hours", () => {
  test("monthStartYmd is the first local day of the month", () => {
    assert.equal(monthStartYmd(new Date(2026, 9, 3)), "2026-10-01");
  });

  test("sumShiftMinutesInRange includes days from start up to exclusive end", () => {
    const shifts = [
      {
        weekStart: "2026-09-28",
        dayIndex: 3, // 2026-10-01
        startMin: 7 * 60,
        endMin: 15 * 60,
      },
      {
        weekStart: "2026-09-28",
        dayIndex: 4, // 2026-10-02
        startMin: 10 * 60,
        endMin: 14 * 60,
      },
      {
        weekStart: "2026-09-28",
        dayIndex: 5, // 2026-10-03 — excluded when exclusive end is 10-03
        startMin: 7 * 60,
        endMin: 22 * 60,
      },
    ];
    const minutes = sumShiftMinutesInRange(
      shifts,
      "2026-10-01",
      "2026-10-03",
    );
    assert.equal(minutes, 8 * 60 + 4 * 60);
  });

  test("formatDurationMinutes always shows hours and zero-padded minutes", () => {
    assert.equal(formatDurationMinutes(195, "ч", "мин"), "3ч 15мин");
    assert.equal(formatDurationMinutes(180, "h", "m"), "3h 00m");
    assert.equal(formatDurationMinutes(45, "h", "m"), "0h 45m");
  });
});

describe("autoFillDay", () => {
  test("splits the day across all staff evenly", () => {
    const staff = ["a", "b", "c"];
    const shifts = autoFillDay({
      dayIndex: 0,
      staffUserIds: staff,
    });
    assert.equal(shifts.length, 3);
    const covered = shifts.reduce((n, s) => n + (s.endMin - s.startMin), 0);
    assert.equal(covered, SCHEDULE_SPAN_MIN);
    assert.equal(Math.min(...shifts.map((s) => s.startMin)), SCHEDULE_OPEN_MIN);
    assert.equal(Math.max(...shifts.map((s) => s.endMin)), SCHEDULE_CLOSE_MIN);
  });

  test("orders people with fewer month hours first", () => {
    const shifts = autoFillDay({
      dayIndex: 1,
      staffUserIds: ["alice", "bob"],
      hoursThisMonthMin: { alice: 20 * 60, bob: 5 * 60 },
    });
    assert.equal(shifts[0]?.userId, "bob");
    assert.equal(shifts[1]?.userId, "alice");
    assert.equal(shifts[0]?.startMin, SCHEDULE_OPEN_MIN);
    assert.equal(shifts[1]?.endMin, SCHEDULE_CLOSE_MIN);
  });
});

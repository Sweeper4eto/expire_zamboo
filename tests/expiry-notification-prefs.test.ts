import test from "node:test";
import assert from "node:assert/strict";
import {
  buildTimeSlotOptions,
  digestKindForTier,
  isInQuietHours,
  isInTierSendWindow,
  itemsForDigestTier,
  mergeClientDefaults,
  parseTimeToMinutes,
  prefsFromUserRow,
  resolveNotifyStoreIds,
  shouldSendTierNow,
  snapTimeToStep,
  SYSTEM_DEFAULT_PREFS,
} from "../src/lib/expiry-notification-prefs";

const baseRow = {
  expiryNotifyEarlyEnabled: true,
  expiryNotifyEarlyDays: 14,
  expiryNotifyUrgentEnabled: true,
  expiryNotifyUrgentDays: 3,
  expiryNotifySchedule: "daily",
  expiryNotifyTime1: "09:00",
  expiryNotifyTime2: "18:00",
  expiryNotifyMinIntervalHours: 24,
  expiryQuietHoursEnabled: false,
  expiryQuietHoursStart: "22:00",
  expiryQuietHoursEnd: "07:00",
  expiryNotifyTimezone: "Europe/Sofia",
  expiryNotifyStoreIdsJson: null,
  expiryNotifyPrefsCustomized: false,
};

test("parseTimeToMinutes converts HH:mm", () => {
  assert.equal(parseTimeToMinutes("09:00"), 9 * 60);
  assert.equal(parseTimeToMinutes("22:30"), 22 * 60 + 30);
});

test("snapTimeToStep rounds to 15 minutes", () => {
  assert.equal(snapTimeToStep("12:11"), "12:15");
  assert.equal(snapTimeToStep("12:07"), "12:00");
  assert.equal(snapTimeToStep("09:00"), "09:00");
  assert.equal(snapTimeToStep("23:59"), "00:00");
});

test("buildTimeSlotOptions has 96 quarter-hours", () => {
  const options = buildTimeSlotOptions();
  assert.equal(options.length, 96);
  assert.equal(options[0]?.value, "00:00");
  assert.equal(options[1]?.value, "00:15");
  assert.equal(options[95]?.value, "23:45");
});

test("isInQuietHours handles overnight window", () => {
  assert.equal(isInQuietHours(23 * 60, "22:00", "07:00"), true);
  assert.equal(isInQuietHours(8 * 60, "22:00", "07:00"), false);
  assert.equal(isInQuietHours(3 * 60, "22:00", "07:00"), true);
});

test("itemsForDigestTier keeps overlapping products in both windows", () => {
  const prefs = prefsFromUserRow(baseRow);
  const items = [{ daysUntilExpiry: 2 }, { daysUntilExpiry: 10 }];
  const urgent = itemsForDigestTier(items, prefs, "urgent");
  const early = itemsForDigestTier(items, prefs, "early");
  assert.equal(urgent.length, 1);
  assert.equal(early.length, 2);
});

test("itemsForDigestTier returns early-only when no urgent items", () => {
  const prefs = prefsFromUserRow(baseRow);
  const early = itemsForDigestTier([{ daysUntilExpiry: 10 }], prefs, "early");
  const urgent = itemsForDigestTier([{ daysUntilExpiry: 10 }], prefs, "urgent");
  assert.equal(early.length, 1);
  assert.equal(urgent.length, 0);
});

test("digestKindForTier is independent per tier", () => {
  assert.equal(digestKindForTier("early"), "expiry-digest-early");
  assert.equal(digestKindForTier("urgent"), "expiry-digest-urgent");
});

test("resolveNotifyStoreIds filters to assigned stores", () => {
  const prefs = { ...SYSTEM_DEFAULT_PREFS, storeIds: ["s1", "s9"] };
  assert.deepEqual(resolveNotifyStoreIds(prefs, ["s1", "s2"]), ["s1"]);
});

test("mergeClientDefaults applies client values for non-customized users", () => {
  const user = prefsFromUserRow(baseRow);
  const merged = mergeClientDefaults(user, {
    earlyDays: 21,
    urgentDays: 1,
    schedule: null,
    time1: "08:00",
    time2: null,
    minIntervalHours: null,
    quietEnabled: null,
    quietStart: null,
    quietEnd: null,
    timezone: null,
  });
  assert.equal(merged.earlyDays, 21);
  assert.equal(merged.urgentDays, 1);
  assert.equal(merged.time1, "08:00");
});

test("legacy twice_daily schedule is normalized to daily", () => {
  const prefs = prefsFromUserRow({
    ...baseRow,
    expiryNotifySchedule: "twice_daily",
  });
  assert.equal(prefs.schedule, "daily");
});

test("shouldSendTierNow ignores legacy quiet hours", () => {
  const prefs = prefsFromUserRow({
    ...baseRow,
    expiryQuietHoursEnabled: true,
    expiryQuietHoursStart: "00:00",
    expiryQuietHoursEnd: "23:59",
  });
  assert.equal(prefs.quietHoursEnabled, false);
  const atNine = new Date("2026-06-02T06:00:30Z");
  assert.equal(shouldSendTierNow(prefs, "early", null, atNine), true);
});

test("isInTierSendWindow uses per-tier clock times", () => {
  const prefs = prefsFromUserRow(baseRow);
  const nineAmSofia = new Date("2026-06-02T06:00:00Z");
  assert.equal(isInTierSendWindow(nineAmSofia, prefs, "early"), true);
  assert.equal(isInTierSendWindow(nineAmSofia, prefs, "urgent"), false);

  const sixPmSofia = new Date("2026-06-02T15:00:00Z");
  assert.equal(isInTierSendWindow(sixPmSofia, prefs, "early"), false);
  assert.equal(isInTierSendWindow(sixPmSofia, prefs, "urgent"), true);
});

test("shouldSendTierNow does not catch-up hours later", () => {
  const prefs = prefsFromUserRow(baseRow);
  const afternoon = new Date("2026-06-02T12:00:00Z"); // 15:00 Sofia
  assert.equal(shouldSendTierNow(prefs, "early", null, afternoon), false);
  assert.equal(shouldSendTierNow(prefs, "urgent", null, afternoon), false);
});

test("shouldSendTierNow fires early at morning time", () => {
  const prefs = prefsFromUserRow(baseRow);
  const atNine = new Date("2026-06-02T06:00:30Z");
  assert.equal(shouldSendTierNow(prefs, "early", null, atNine), true);
  assert.equal(shouldSendTierNow(prefs, "urgent", null, atNine), false);
});

test("shouldSendTierNow skips same tier again in the same window", () => {
  const prefs = prefsFromUserRow(baseRow);
  const morningSend = new Date("2026-06-02T06:00:10Z");
  const stillInWindow = new Date("2026-06-02T06:01:00Z");
  assert.equal(
    shouldSendTierNow(prefs, "early", morningSend, stillInWindow),
    false,
  );
});

test("same clock for both tiers can fire both independently", () => {
  const prefs = prefsFromUserRow({
    ...baseRow,
    expiryNotifyTime1: "09:00",
    expiryNotifyTime2: "09:00",
  });
  const atNine = new Date("2026-06-02T06:00:30Z");
  assert.equal(shouldSendTierNow(prefs, "early", null, atNine), true);
  assert.equal(shouldSendTierNow(prefs, "urgent", null, atNine), true);
  // Early already sent — urgent still due (separate log kind in production).
  const earlySent = new Date("2026-06-02T06:00:10Z");
  assert.equal(shouldSendTierNow(prefs, "early", earlySent, atNine), false);
  assert.equal(shouldSendTierNow(prefs, "urgent", null, atNine), true);
});

test("shouldSendTierNow allows urgent at its own evening slot", () => {
  const prefs = prefsFromUserRow(baseRow);
  const morningSend = new Date("2026-06-02T06:00:10Z");
  const evening = new Date("2026-06-02T15:00:20Z"); // 18:00 Sofia
  assert.equal(shouldSendTierNow(prefs, "early", morningSend, evening), false);
  assert.equal(shouldSendTierNow(prefs, "urgent", null, evening), true);
});

test("shouldSendTierNow allows next day at schedule time", () => {
  const prefs = prefsFromUserRow(baseRow);
  const yesterday = new Date("2026-06-01T06:00:10Z");
  const todayAtNine = new Date("2026-06-02T06:00:20Z");
  assert.equal(shouldSendTierNow(prefs, "early", yesterday, todayAtNine), true);
});

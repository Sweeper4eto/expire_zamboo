import { z } from "zod";

export type NotifySchedule = "daily" | "twice_daily";

export type ExpiryNotificationPrefs = {
  earlyEnabled: boolean;
  earlyDays: number;
  urgentEnabled: boolean;
  urgentDays: number;
  schedule: NotifySchedule;
  time1: string;
  time2: string;
  minIntervalHours: number;
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
  timezone: string;
  storeIds: string[] | null;
  customized: boolean;
};

export type ClientExpiryDefaults = {
  earlyDays: number | null;
  urgentDays: number | null;
  schedule: NotifySchedule | null;
  time1: string | null;
  time2: string | null;
  minIntervalHours: number | null;
  quietEnabled: boolean | null;
  quietStart: string | null;
  quietEnd: string | null;
  timezone: string | null;
};

export const SYSTEM_DEFAULT_PREFS: ExpiryNotificationPrefs = {
  earlyEnabled: true,
  earlyDays: 14,
  urgentEnabled: true,
  urgentDays: 3,
  schedule: "daily",
  /** Early warning send time (once per day). */
  time1: "09:00",
  /** Urgent send time (once per day). */
  time2: "18:00",
  minIntervalHours: 24,
  quietHoursEnabled: false,
  quietHoursStart: "22:00",
  quietHoursEnd: "07:00",
  timezone: "Europe/Sofia",
  storeIds: null,
  customized: false,
};

const timePattern = /^([01]\d|2[0-3]):([0-5]\d)$/;

export const expiryNotificationPrefsSchema = z
  .object({
    earlyEnabled: z.boolean(),
    earlyDays: z.number().int().min(1).max(90),
    urgentEnabled: z.boolean(),
    urgentDays: z.number().int().min(0).max(90),
    schedule: z.literal("daily"),
    /** Early warning clock time */
    time1: z.string().regex(timePattern),
    /** Urgent clock time */
    time2: z.string().regex(timePattern),
    minIntervalHours: z.number().int().min(6).max(168),
    quietHoursEnabled: z.boolean(),
    quietHoursStart: z.string().regex(timePattern),
    quietHoursEnd: z.string().regex(timePattern),
    timezone: z.string().min(1).max(64),
    storeIds: z.array(z.string().min(1)).nullable(),
  })
  .refine((value) => value.earlyEnabled || value.urgentEnabled, {
    message: "At least one alert tier must be enabled",
  })
  .refine(
    (value) =>
      !value.earlyEnabled ||
      !value.urgentEnabled ||
      value.earlyDays >= value.urgentDays,
    { message: "Early warning days must be >= urgent days" },
  );

export type UserPrefsRow = {
  expiryNotifyEarlyEnabled: boolean;
  expiryNotifyEarlyDays: number;
  expiryNotifyUrgentEnabled: boolean;
  expiryNotifyUrgentDays: number;
  expiryNotifySchedule: string;
  expiryNotifyTime1: string;
  expiryNotifyTime2: string;
  expiryNotifyMinIntervalHours: number;
  expiryQuietHoursEnabled: boolean;
  expiryQuietHoursStart: string;
  expiryQuietHoursEnd: string;
  expiryNotifyTimezone: string;
  expiryNotifyStoreIdsJson: string | null;
  expiryNotifyPrefsCustomized: boolean;
};

export type ClientDefaultsRow = {
  expiryDefaultEarlyDays: number | null;
  expiryDefaultUrgentDays: number | null;
  expiryDefaultSchedule: string | null;
  expiryDefaultTime1: string | null;
  expiryDefaultTime2: string | null;
  expiryDefaultMinIntervalHours: number | null;
  expiryDefaultQuietEnabled: boolean | null;
  expiryDefaultQuietStart: string | null;
  expiryDefaultQuietEnd: string | null;
  expiryDefaultTimezone: string | null;
};

function parseSchedule(_value: string): NotifySchedule {
  // Frequency UI retired — each tier is always once daily at its own clock time.
  return "daily";
}

export function clientDefaultsFromRow(
  row: ClientDefaultsRow | null | undefined,
): ClientExpiryDefaults | null {
  if (!row) return null;
  const hasAny =
    row.expiryDefaultEarlyDays != null ||
    row.expiryDefaultUrgentDays != null ||
    row.expiryDefaultSchedule != null ||
    row.expiryDefaultTime1 != null;
  if (!hasAny) return null;

  return {
    earlyDays: row.expiryDefaultEarlyDays,
    urgentDays: row.expiryDefaultUrgentDays,
    schedule: row.expiryDefaultSchedule
      ? parseSchedule(row.expiryDefaultSchedule)
      : null,
    time1: row.expiryDefaultTime1,
    time2: row.expiryDefaultTime2,
    minIntervalHours: row.expiryDefaultMinIntervalHours,
    quietEnabled: row.expiryDefaultQuietEnabled,
    quietStart: row.expiryDefaultQuietStart,
    quietEnd: row.expiryDefaultQuietEnd,
    timezone: row.expiryDefaultTimezone,
  };
}

export function prefsFromUserRow(row: UserPrefsRow): ExpiryNotificationPrefs {
  let storeIds: string[] | null = null;
  if (row.expiryNotifyStoreIdsJson) {
    try {
      const parsed = JSON.parse(row.expiryNotifyStoreIdsJson) as unknown;
      if (Array.isArray(parsed) && parsed.every((id) => typeof id === "string")) {
        storeIds = parsed.length > 0 ? parsed : null;
      }
    } catch {
      storeIds = null;
    }
  }

  return {
    earlyEnabled: row.expiryNotifyEarlyEnabled,
    earlyDays: row.expiryNotifyEarlyDays,
    urgentEnabled: row.expiryNotifyUrgentEnabled,
    urgentDays: row.expiryNotifyUrgentDays,
    schedule: parseSchedule(row.expiryNotifySchedule),
    time1: snapTimeToStep(row.expiryNotifyTime1),
    time2: snapTimeToStep(row.expiryNotifyTime2),
    minIntervalHours: row.expiryNotifyMinIntervalHours,
    // Quiet hours UI retired — never suppress by night window.
    quietHoursEnabled: false,
    quietHoursStart: snapTimeToStep(row.expiryQuietHoursStart),
    quietHoursEnd: snapTimeToStep(row.expiryQuietHoursEnd),
    timezone: row.expiryNotifyTimezone,
    storeIds,
    customized: row.expiryNotifyPrefsCustomized,
  };
}

export function mergeClientDefaults(
  prefs: ExpiryNotificationPrefs,
  defaults: ClientExpiryDefaults | null,
): ExpiryNotificationPrefs {
  if (!defaults || prefs.customized) return prefs;

  return {
    ...prefs,
    earlyDays: defaults.earlyDays ?? prefs.earlyDays,
    urgentDays: defaults.urgentDays ?? prefs.urgentDays,
    schedule: defaults.schedule ?? prefs.schedule,
    time1: defaults.time1 ?? prefs.time1,
    time2: defaults.time2 ?? prefs.time2,
    minIntervalHours: defaults.minIntervalHours ?? prefs.minIntervalHours,
    quietHoursEnabled: false,
    quietHoursStart: defaults.quietStart ?? prefs.quietHoursStart,
    quietHoursEnd: defaults.quietEnd ?? prefs.quietHoursEnd,
    timezone: defaults.timezone ?? prefs.timezone,
  };
}

export function prefsToUserData(prefs: ExpiryNotificationPrefs) {
  return {
    expiryNotifyEarlyEnabled: prefs.earlyEnabled,
    expiryNotifyEarlyDays: prefs.earlyDays,
    expiryNotifyUrgentEnabled: prefs.urgentEnabled,
    expiryNotifyUrgentDays: prefs.urgentDays,
    expiryNotifySchedule: prefs.schedule,
    expiryNotifyTime1: snapTimeToStep(prefs.time1),
    expiryNotifyTime2: snapTimeToStep(prefs.time2),
    expiryNotifyMinIntervalHours: prefs.minIntervalHours,
    expiryQuietHoursEnabled: false,
    expiryQuietHoursStart: snapTimeToStep(prefs.quietHoursStart),
    expiryQuietHoursEnd: snapTimeToStep(prefs.quietHoursEnd),
    expiryNotifyTimezone: prefs.timezone,
    expiryNotifyStoreIdsJson:
      prefs.storeIds && prefs.storeIds.length > 0
        ? JSON.stringify(prefs.storeIds)
        : null,
    expiryNotifyPrefsCustomized: true,
  };
}

export function parseTimeToMinutes(value: string): number {
  const [h, m] = value.split(":").map(Number);
  return h * 60 + m;
}

export function getLocalTimeParts(
  date: Date,
  timeZone: string,
): { hour: number; minute: number } {
  try {
    const fmt = new Intl.DateTimeFormat("en-GB", {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const parts = fmt.formatToParts(date);
    // Some engines report midnight as 24 — normalize to 0.
    let hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
    if (hour === 24) hour = 0;
    const minute = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
    return { hour, minute };
  } catch {
    return { hour: date.getUTCHours(), minute: date.getUTCMinutes() };
  }
}

function localDateKey(date: Date, timeZone: string): string {
  try {
    return date.toLocaleDateString("en-CA", { timeZone });
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

function localMinutesOf(date: Date, timeZone: string): number {
  const { hour, minute } = getLocalTimeParts(date, timeZone);
  return hour * 60 + minute;
}

/** Scheduled send times for today, sorted ascending (minutes from midnight). */
export function scheduledSlotMinutes(
  prefs: Pick<ExpiryNotificationPrefs, "time1" | "time2">,
): number[] {
  return [
    ...new Set([
      parseTimeToMinutes(prefs.time1),
      parseTimeToMinutes(prefs.time2),
    ]),
  ].sort((a, b) => a - b);
}

export function isInQuietHours(
  localMinutes: number,
  start: string,
  end: string,
): boolean {
  const startM = parseTimeToMinutes(start);
  const endM = parseTimeToMinutes(end);
  if (startM === endM) return false;
  if (startM < endM) {
    return localMinutes >= startM && localMinutes < endM;
  }
  return localMinutes >= startM || localMinutes < endM;
}

/**
 * Minutes after each scheduled clock time when cron may still deliver.
 * Matches 15-minute schedule slots / cron every 15 minutes.
 */
export const NOTIFY_TIME_STEP_MINUTES = 15;
export const SEND_WINDOW_GRACE_MINUTES = NOTIFY_TIME_STEP_MINUTES;

export function formatMinutesAsTime(totalMinutes: number): string {
  const day = ((totalMinutes % (24 * 60)) + 24 * 60) % (24 * 60);
  const hour = Math.floor(day / 60);
  const minute = day % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

/** Snap HH:mm to the nearest 15-minute step (00 / 15 / 30 / 45). */
export function snapTimeToStep(
  value: string,
  stepMinutes = NOTIFY_TIME_STEP_MINUTES,
): string {
  if (!timePattern.test(value)) return formatMinutesAsTime(0);
  const mins = parseTimeToMinutes(value);
  const snapped = Math.round(mins / stepMinutes) * stepMinutes;
  return formatMinutesAsTime(snapped);
}

export function buildTimeSlotOptions(
  stepMinutes = NOTIFY_TIME_STEP_MINUTES,
): Array<{ value: string; label: string }> {
  const options: Array<{ value: string; label: string }> = [];
  for (let mins = 0; mins < 24 * 60; mins += stepMinutes) {
    const value = formatMinutesAsTime(mins);
    options.push({ value, label: value });
  }
  return options;
}

export type DigestTier = "urgent" | "early";

export function digestKindForTier(tier: DigestTier): string {
  return tier === "urgent" ? "expiry-digest-urgent" : "expiry-digest-early";
}

export function timeForTier(
  prefs: Pick<ExpiryNotificationPrefs, "time1" | "time2">,
  tier: DigestTier,
): string {
  return tier === "urgent" ? prefs.time2 : prefs.time1;
}

export function isInTierSendWindow(
  now: Date,
  prefs: Pick<ExpiryNotificationPrefs, "time1" | "time2" | "timezone">,
  tier: DigestTier,
  graceMinutes = SEND_WINDOW_GRACE_MINUTES,
): boolean {
  const slot = parseTimeToMinutes(timeForTier(prefs, tier));
  const localMinutes = localMinutesOf(now, prefs.timezone);
  return localMinutes >= slot && localMinutes < slot + graceMinutes;
}

/** @deprecated Prefer isInTierSendWindow — kept for older call sites. */
export function isInSendWindow(
  now: Date,
  prefs: Pick<ExpiryNotificationPrefs, "time1" | "time2" | "timezone">,
  graceMinutes = SEND_WINDOW_GRACE_MINUTES,
): boolean {
  return (
    isInTierSendWindow(now, prefs, "early", graceMinutes) ||
    isInTierSendWindow(now, prefs, "urgent", graceMinutes)
  );
}

export function shouldSendTierNow(
  prefs: ExpiryNotificationPrefs,
  tier: DigestTier,
  lastSentAt: Date | null,
  now = new Date(),
): boolean {
  if (tier === "early" && !prefs.earlyEnabled) return false;
  if (tier === "urgent" && !prefs.urgentEnabled) return false;
  if (!isInTierSendWindow(now, prefs, tier)) return false;

  const dueSlot = parseTimeToMinutes(timeForTier(prefs, tier));
  if (!lastSentAt) return true;

  const today = localDateKey(now, prefs.timezone);
  const lastDay = localDateKey(lastSentAt, prefs.timezone);
  if (lastDay !== today) return true;

  const lastMinutes = localMinutesOf(lastSentAt, prefs.timezone);
  return lastMinutes < dueSlot;
}

/** @deprecated Use shouldSendTierNow */
export function shouldSendNotificationNow(
  prefs: ExpiryNotificationPrefs,
  lastSentAt: Date | null,
  now = new Date(),
): boolean {
  return (
    shouldSendTierNow(prefs, "early", lastSentAt, now) ||
    shouldSendTierNow(prefs, "urgent", lastSentAt, now)
  );
}

export function resolveNotifyStoreIds(
  prefs: ExpiryNotificationPrefs,
  assignedStoreIds: string[],
): string[] {
  if (assignedStoreIds.length === 0) return [];
  if (!prefs.storeIds || prefs.storeIds.length === 0) {
    return assignedStoreIds;
  }
  const allowed = new Set(assignedStoreIds);
  return prefs.storeIds.filter((id) => allowed.has(id));
}

/** Products included in a tier digest (windows may overlap on purpose). */
export function itemsForDigestTier<T extends { daysUntilExpiry: number }>(
  items: T[],
  prefs: Pick<
    ExpiryNotificationPrefs,
    "earlyEnabled" | "earlyDays" | "urgentEnabled" | "urgentDays"
  >,
  tier: DigestTier,
): T[] {
  if (tier === "urgent") {
    if (!prefs.urgentEnabled) return [];
    return items.filter((item) => item.daysUntilExpiry <= prefs.urgentDays);
  }
  if (!prefs.earlyEnabled) return [];
  return items.filter((item) => item.daysUntilExpiry <= prefs.earlyDays);
}

export function withinDaysForTier(
  prefs: Pick<ExpiryNotificationPrefs, "earlyDays" | "urgentDays">,
  tier: DigestTier,
): number {
  return tier === "urgent" ? prefs.urgentDays : prefs.earlyDays;
}

/** @deprecated Prefer itemsForDigestTier — returns first non-empty tier only. */
export function splitItemsByTier(
  items: Array<{ daysUntilExpiry: number }>,
  prefs: Pick<
    ExpiryNotificationPrefs,
    "earlyEnabled" | "earlyDays" | "urgentEnabled" | "urgentDays"
  >,
): { tier: DigestTier; withinDays: number; items: typeof items } | null {
  const urgentItems = itemsForDigestTier(items, prefs, "urgent");
  if (urgentItems.length > 0) {
    return { tier: "urgent", withinDays: prefs.urgentDays, items: urgentItems };
  }
  const earlyItems = itemsForDigestTier(items, prefs, "early");
  if (earlyItems.length > 0) {
    return { tier: "early", withinDays: prefs.earlyDays, items: earlyItems };
  }
  return null;
}

export function formatPrefsSummary(
  prefs: ExpiryNotificationPrefs,
  labels: {
    urgentDays: (days: number) => string;
    earlyDays: (days: number) => string;
    time: (time: string) => string;
    allStores: string;
    storeCount: (count: number) => string;
    off: string;
  },
): string {
  const parts: string[] = [];
  if (prefs.earlyEnabled) {
    parts.push(`${labels.earlyDays(prefs.earlyDays)} · ${labels.time(prefs.time1)}`);
  }
  if (prefs.urgentEnabled) {
    parts.push(`${labels.urgentDays(prefs.urgentDays)} · ${labels.time(prefs.time2)}`);
  }
  if (parts.length === 0) return labels.off;
  if (prefs.storeIds && prefs.storeIds.length > 0) {
    parts.push(labels.storeCount(prefs.storeIds.length));
  } else {
    parts.push(labels.allStores);
  }
  return parts.join(" · ");
}

export const clientDefaultsSchema = z.object({
  earlyDays: z.number().int().min(1).max(90).nullable().optional(),
  urgentDays: z.number().int().min(0).max(90).nullable().optional(),
  schedule: z.literal("daily").nullable().optional(),
  time1: z.string().regex(timePattern).nullable().optional(),
  time2: z.string().regex(timePattern).nullable().optional(),
  minIntervalHours: z.number().int().min(6).max(168).nullable().optional(),
  quietEnabled: z.boolean().nullable().optional(),
  quietStart: z.string().regex(timePattern).nullable().optional(),
  quietEnd: z.string().regex(timePattern).nullable().optional(),
  timezone: z.string().min(1).max(64).nullable().optional(),
});

export function clientDefaultsToData(
  defaults: z.infer<typeof clientDefaultsSchema>,
) {
  return {
    expiryDefaultEarlyDays: defaults.earlyDays ?? null,
    expiryDefaultUrgentDays: defaults.urgentDays ?? null,
    expiryDefaultSchedule: defaults.schedule ?? null,
    expiryDefaultTime1: defaults.time1 ?? null,
    expiryDefaultTime2: defaults.time2 ?? null,
    expiryDefaultMinIntervalHours: defaults.minIntervalHours ?? null,
    expiryDefaultQuietEnabled: defaults.quietEnabled ?? null,
    expiryDefaultQuietStart: defaults.quietStart ?? null,
    expiryDefaultQuietEnd: defaults.quietEnd ?? null,
    expiryDefaultTimezone: defaults.timezone ?? null,
  };
}

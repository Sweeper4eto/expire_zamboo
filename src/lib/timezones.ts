/** Common IANA zones for the notification-settings dropdown. */
export const COMMON_TIMEZONES = [
  "Europe/Sofia",
  "Europe/Bucharest",
  "Europe/Athens",
  "Europe/Berlin",
  "Europe/Vienna",
  "Europe/Paris",
  "Europe/Amsterdam",
  "Europe/Rome",
  "Europe/Madrid",
  "Europe/London",
  "Europe/Dublin",
  "Europe/Warsaw",
  "Europe/Prague",
  "Europe/Budapest",
  "Europe/Zagreb",
  "Europe/Belgrade",
  "Europe/Istanbul",
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
] as const;

export function detectBrowserTimezone(fallback = "Europe/Sofia"): string {
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone?.trim();
    return zone || fallback;
  } catch {
    return fallback;
  }
}

/** Build dropdown options: common list + detected + current (deduped, sorted). */
export function buildTimezoneOptions(
  detected: string,
  current: string,
  labelFor: (zone: string, isDetected: boolean) => string,
): { value: string; label: string }[] {
  const zones = new Set<string>([...COMMON_TIMEZONES, detected, current]);
  return [...zones]
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b))
    .map((zone) => ({
      value: zone,
      label: labelFor(zone, zone === detected),
    }));
}

/**
 * Before the user has saved notification prefs, prefer the browser zone.
 * After save (`customized`), keep the stored timezone.
 */
export function resolveTimezoneForForm(
  customized: boolean,
  storedTimezone: string,
  detectedTimezone: string,
): string {
  return customized ? storedTimezone : detectedTimezone;
}

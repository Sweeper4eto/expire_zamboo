export const EXPIRY_PERIOD_DAYS = {
  "7d": 7,
  "14d": 14,
  "30d": 30,
} as const;

export const EXPIRY_PERIOD_OPTIONS = ["7d", "14d", "30d", "all"] as const;
export type ExpiryPeriod = (typeof EXPIRY_PERIOD_OPTIONS)[number];

export const DEFAULT_EXPIRY_PERIOD: ExpiryPeriod = "30d";

export const DEFAULT_EXPIRY_FUTURE_DAYS = EXPIRY_PERIOD_DAYS[DEFAULT_EXPIRY_PERIOD];

/** @deprecated Use DEFAULT_EXPIRY_FUTURE_DAYS */
export const EXPIRY_LIST_MAX_FUTURE_DAYS = DEFAULT_EXPIRY_FUTURE_DAYS;

export function parseExpiryPeriod(value: string | null | undefined): ExpiryPeriod {
  // Migrate older stored filter keys to the day-based periods.
  if (value === "today" || value === "3d") return "7d";
  if (value === "2w") return "14d";
  if (value === "1m" || value === "30d") return "30d";
  if (value === "3m" || value === "6m" || value === "expired") return "all";
  if (value && (EXPIRY_PERIOD_OPTIONS as readonly string[]).includes(value)) {
    return value as ExpiryPeriod;
  }
  return DEFAULT_EXPIRY_PERIOD;
}

export function expiryPeriodDays(period: Exclude<ExpiryPeriod, "all">): number {
  return EXPIRY_PERIOD_DAYS[period];
}

export function expiryPeriodToApiParam(period: ExpiryPeriod): string {
  return period === "all" ? "all" : String(expiryPeriodDays(period));
}

export function parseExpiryWithinDays(value: string | null | undefined): number | "all" {
  if (value === "all") return "all";
  const parsed = Number.parseInt(value ?? "", 10);
  const allowed = Object.values(EXPIRY_PERIOD_DAYS);
  if (allowed.includes(parsed as (typeof allowed)[number])) {
    return parsed;
  }
  // Accept legacy API values without breaking callers.
  if (parsed === 3) return 7;
  if (parsed === 90) return "all";
  return expiryPeriodDays("30d");
}

/**
 * Period filters keep every already-expired item and only cap the future
 * horizon (e.g. 14 days => now + 14 days). "all" removes the future cap.
 */
export function expiryListDateBounds(
  now = new Date(),
  futureDays: number | "all" = DEFAULT_EXPIRY_FUTURE_DAYS,
): { maxFuture: Date | null; maxPast: Date | null } {
  if (futureDays === "all") {
    return { maxFuture: null, maxPast: null };
  }
  const maxFuture = new Date(now.getTime() + futureDays * 24 * 60 * 60 * 1000);
  return { maxFuture, maxPast: null };
}

export function expiryListVisible(
  expiryDate: Date,
  now = new Date(),
  futureDays: number | "all" = DEFAULT_EXPIRY_FUTURE_DAYS,
): boolean {
  if (futureDays === "all") return true;
  const { maxFuture } = expiryListDateBounds(now, futureDays);
  if (!maxFuture) return true;
  return expiryDate.getTime() <= maxFuture.getTime();
}

export function expiryUrgencyClass(expiryDate: Date, now = new Date()): string {
  const days = daysUntilExpiry(expiryDate, now);
  if (days <= 7) return "urgency-critical";
  if (days <= 14) return "urgency-warning";
  if (days <= 28) return "urgency-soon";
  return "urgency-normal";
}

export function expiryUrgencyStripeClass(expiryDate: Date, now = new Date()): string {
  const days = daysUntilExpiry(expiryDate, now);
  if (days <= 7) return "bg-[var(--urgency-critical-border)]";
  if (days <= 14) return "bg-[var(--urgency-warning-border)]";
  if (days <= 28) return "bg-[var(--urgency-soon-border)]";
  return "bg-card-border";
}

export function expiryUrgencyBadgeClass(expiryDate: Date, now = new Date()): string {
  const days = daysUntilExpiry(expiryDate, now);
  if (days <= 7) {
    return "border-[var(--urgency-critical-border)] bg-[var(--urgency-critical-bg)] text-error";
  }
  if (days <= 14) {
    return "border-[var(--urgency-warning-border)] bg-[var(--urgency-warning-bg)] text-warning-fg";
  }
  if (days <= 28) {
    return "border-[var(--urgency-soon-border)] bg-[var(--urgency-soon-bg)] text-foreground";
  }
  return "border-card-border bg-transparent text-foreground";
}

export function daysUntilExpiry(expiryDate: Date, now = new Date()): number {
  return Math.ceil(
    (expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
  );
}

/**
 * Day-first calendar date with leading zeros (bg: 15.04.2027, en-GB: 15/04/2027).
 * Never use en-US — MM/DD looks like a day/month swap on Bulgarian expiry docs.
 */
export function formatLocaleDay(
  input: Date | string,
  locale: string,
  options?: { utc?: boolean },
): string {
  let date: Date;
  if (typeof input === "string") {
    const ymd = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input.trim());
    if (ymd) {
      date = new Date(
        Date.UTC(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3])),
      );
      return date.toLocaleDateString(locale, {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        timeZone: "UTC",
      });
    }
    date = new Date(input);
    if (Number.isNaN(date.getTime())) return input;
  } else {
    date = input;
  }

  return date.toLocaleDateString(locale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    ...(options?.utc ? { timeZone: "UTC" } : {}),
  });
}

/** Local time (HH:MM) for list cards — e.g. when an item was added to the cart. */
export function formatLocaleTime(input: Date | string, locale: string): string {
  const date = typeof input === "string" ? new Date(input) : input;
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString(locale, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function paymentAmount(
  totalLocationFees: number,
  discount = 0,
): number {
  return Math.max(0, totalLocationFees - discount);
}

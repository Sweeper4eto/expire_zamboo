import {
  DEFAULT_EXPIRY_PERIOD,
  EXPIRY_PERIOD_OPTIONS,
  type ExpiryPeriod,
  expiryPeriodDays,
  expiryPeriodToApiParam,
  parseExpiryPeriod,
} from "@/lib/expiry";

const STORAGE_KEY = "magazin:expiry-period";

export function getStoredExpiryPeriod(): ExpiryPeriod {
  if (typeof window === "undefined") return DEFAULT_EXPIRY_PERIOD;
  return parseExpiryPeriod(localStorage.getItem(STORAGE_KEY));
}

export function setStoredExpiryPeriod(period: ExpiryPeriod) {
  localStorage.setItem(STORAGE_KEY, period);
}

export { DEFAULT_EXPIRY_PERIOD, EXPIRY_PERIOD_OPTIONS, expiryPeriodDays, expiryPeriodToApiParam };
export type { ExpiryPeriod };

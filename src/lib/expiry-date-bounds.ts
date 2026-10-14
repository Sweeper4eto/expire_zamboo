import { toYmdLocal } from "@/lib/expiry-date-input";

export const EXPIRY_PICKER_YEARS_AHEAD = 20;
export const EXPIRY_PICKER_YEARS_PAST = 3;

export function expiryDateBounds(allowPast = false): { min: string; max: string } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const min = new Date(today);
  if (allowPast) {
    min.setFullYear(min.getFullYear() - EXPIRY_PICKER_YEARS_PAST);
  }
  const max = new Date(today);
  max.setFullYear(max.getFullYear() + EXPIRY_PICKER_YEARS_AHEAD);

  return { min: toYmdLocal(min), max: toYmdLocal(max) };
}

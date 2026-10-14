import type { Locale } from "@/i18n";

export type MobileLocale = Extract<Locale, "en" | "bg">;

export const CLIENT_LOCALE_KEY = "magazin-locale";
export const CLIENT_LOCALE_COOKIE = "magazin-locale";
/** Fired after setClientLocale so root UI (e.g. PWA install) stays in sync. */
export const CLIENT_LOCALE_CHANGED_EVENT = "expire365-locale-changed";

export const mobileLocales: MobileLocale[] = ["en", "bg"];

export function isMobileLocale(value: string | null): value is MobileLocale {
  return value === "en" || value === "bg";
}

export function getClientLocale(): MobileLocale {
  if (typeof window === "undefined") return "en";

  const stored = localStorage.getItem(CLIENT_LOCALE_KEY);
  if (isMobileLocale(stored)) return stored;

  const browser = navigator.language.slice(0, 2).toLowerCase();
  return browser === "bg" ? "bg" : "en";
}

export function setClientLocale(locale: MobileLocale): void {
  localStorage.setItem(CLIENT_LOCALE_KEY, locale);
  document.cookie = `${CLIENT_LOCALE_COOKIE}=${locale};path=/;max-age=31536000;SameSite=Lax`;
  document.documentElement.lang = locale;
  window.dispatchEvent(new Event(CLIENT_LOCALE_CHANGED_EVENT));
}

import { en, type Messages } from "./messages/en";
import { bg } from "./messages/bg";

export type Locale = "en" | "bg";

export const locales: Locale[] = ["en", "bg"];
export const mobileLocales: Locale[] = ["en", "bg"];
export const defaultLocale: Locale =
  (process.env.NEXT_PUBLIC_LOCALE as Locale | undefined) ?? "en";

const catalogs: Record<Locale, Messages> = { en, bg };

type NestedKeyOf<T, Prefix extends string = ""> = T extends object
  ? {
      [K in keyof T & string]: T[K] extends object
        ? NestedKeyOf<T[K], `${Prefix}${K}.`>
        : `${Prefix}${K}`;
    }[keyof T & string]
  : never;

export type MessageKey = NestedKeyOf<Messages>;

function resolveMessage(
  catalog: Messages,
  key: string,
): string | undefined {
  const parts = key.split(".");
  let current: unknown = catalog;
  for (const part of parts) {
    if (typeof current !== "object" || current === null) return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return typeof current === "string" ? current : undefined;
}

export function t(
  key: MessageKey,
  params?: Record<string, string | number>,
  locale: Locale = defaultLocale,
): string {
  const template =
    resolveMessage(catalogs[locale], key) ??
    resolveMessage(catalogs.en, key) ??
    key;

  return template.replace(/\{(\w+)\}/g, (_, name: string) =>
    String(params?.[name] ?? `{${name}}`),
  );
}

function localeFromCookie(cookieHeader: string): Locale | null {
  const match = cookieHeader.match(/(?:^|;\s*)magazin-locale=(en|bg)(?:;|$)/);
  if (match?.[1] && locales.includes(match[1] as Locale)) {
    return match[1] as Locale;
  }
  return null;
}

export function getLocaleFromRequest(request: Request): Locale {
  const cookieLocale = localeFromCookie(request.headers.get("cookie") ?? "");
  if (cookieLocale) return cookieLocale;

  const header = request.headers.get("accept-language") ?? "";
  const preferred = header.split(",")[0]?.trim().slice(0, 2).toLowerCase();
  if (preferred && locales.includes(preferred as Locale)) {
    return preferred as Locale;
  }
  return defaultLocale;
}

export function apiT(
  request: Request,
  key: MessageKey,
  params?: Record<string, string | number>,
): string {
  return t(key, params, getLocaleFromRequest(request));
}

export function monthName(month: number, locale: Locale = defaultLocale): string {
  const keys = [
    "months.january",
    "months.february",
    "months.march",
    "months.april",
    "months.may",
    "months.june",
    "months.july",
    "months.august",
    "months.september",
    "months.october",
    "months.november",
    "months.december",
  ] as const;
  return t(keys[month - 1] ?? "months.january", undefined, locale);
}

export function dateLocale(locale: Locale = defaultLocale): string {
  if (locale === "bg") return "bg-BG";
  // en-GB keeps day-first (DD/MM) like Bulgarian docs — never en-US MM/DD.
  return "en-GB";
}

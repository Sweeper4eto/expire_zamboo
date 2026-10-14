"use client";

import { createContext, useContext, useMemo } from "react";
import {
  dateLocale,
  defaultLocale,
  monthName,
  t,
  type Locale,
  type MessageKey,
} from "@/i18n";

type I18nContextValue = {
  locale: Locale;
  t: (key: MessageKey, params?: Record<string, string | number>) => string;
  monthName: (month: number) => string;
  dateLocale: string;
};

const I18nContext = createContext<I18nContextValue>({
  locale: defaultLocale,
  t: (key, params) => t(key, params, defaultLocale),
  monthName: (month) => monthName(month, defaultLocale),
  dateLocale: dateLocale(defaultLocale),
});

export function I18nProvider({
  children,
  locale = defaultLocale,
}: {
  children: React.ReactNode;
  locale?: Locale;
}) {
  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      t: (key, params) => t(key, params, locale),
      monthName: (month) => monthName(month, locale),
      dateLocale: dateLocale(locale),
    }),
    [locale],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useT() {
  return useContext(I18nContext);
}

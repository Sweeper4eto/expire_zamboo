"use client";

import { useEffect, useState } from "react";
import { I18nProvider } from "@/components/i18n-provider";
import {
  CLIENT_LOCALE_CHANGED_EVENT,
  getClientLocale,
  type MobileLocale,
} from "@/lib/client-locale";

/**
 * Root locale for chrome that sits outside page-level MobileI18nProvider
 * (PWA install prompt, etc.). Follows the same localStorage/cookie choice
 * the language switch writes.
 */
export function RootClientI18nProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [locale, setLocale] = useState<MobileLocale>("en");

  useEffect(() => {
    const sync = () => setLocale(getClientLocale());
    sync();
    window.addEventListener(CLIENT_LOCALE_CHANGED_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(CLIENT_LOCALE_CHANGED_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  return <I18nProvider locale={locale}>{children}</I18nProvider>;
}

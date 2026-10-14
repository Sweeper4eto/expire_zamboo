"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { I18nProvider } from "@/components/i18n-provider";
import {
  getClientLocale,
  setClientLocale,
  type MobileLocale,
} from "@/lib/client-locale";
import { syncPushLocale } from "@/lib/sync-push-locale";

type MobileLocaleContextValue = {
  locale: MobileLocale;
  setLocale: (locale: MobileLocale) => void;
};

const MobileLocaleContext = createContext<MobileLocaleContextValue | null>(null);

export function MobileI18nProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [locale, setLocaleState] = useState<MobileLocale>(() =>
    typeof window !== "undefined" ? getClientLocale() : "en",
  );

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback((next: MobileLocale) => {
    setClientLocale(next);
    setLocaleState(next);
    syncPushLocale(next);
  }, []);

  return (
    <MobileLocaleContext.Provider value={{ locale, setLocale }}>
      <I18nProvider locale={locale}>{children}</I18nProvider>
    </MobileLocaleContext.Provider>
  );
}

export function useMobileLocale() {
  const context = useContext(MobileLocaleContext);
  if (!context) {
    throw new Error("useMobileLocale must be used within MobileI18nProvider");
  }
  return context;
}

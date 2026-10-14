"use client";

import { useEffect, useMemo, useState } from "react";
import { LanguageSwitch } from "@/components/language-switch";
import { MenuSelect } from "@/components/menu-select";
import { useAppSession } from "@/components/app-session-provider";
import { useT } from "@/components/i18n-provider";
import { getStoredStoreId, setStoredStoreId, clearStoredStoreId } from "@/lib/store-selection";
import { navigateApp } from "@/lib/app-navigation";

function StoreIcon({ className = "size-3.5" }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M4 10h16l-1.2 9.2A2 2 0 0 1 16.81 21H7.19a2 2 0 0 1-1.99-1.8L4 10Z" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

/** Language control for the header (flag sits above the store chip). */
export function AppLanguageAction() {
  return <LanguageSwitch />;
}

/** Compact location picker under the language flag (≤30vw via header stack). */
export function AppStoreSelect() {
  const { t } = useT();
  const { user, ready } = useAppSession();
  const stores = useMemo(() => user?.stores ?? [], [user?.stores]);
  const [storeId, setStoreId] = useState("");

  useEffect(() => {
    if (!ready) return;
    if (stores.length === 0) {
      setStoreId("");
      clearStoredStoreId();
      return;
    }
    const stored = getStoredStoreId();
    const valid = stores.find((store) => store.id === stored);
    const nextId = valid?.id ?? stores[0]?.id ?? "";
    setStoreId(nextId);
    if (nextId) setStoredStoreId(nextId);
  }, [ready, stores]);

  function onStoreChange(nextId: string) {
    setStoreId(nextId);
    setStoredStoreId(nextId);

    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (url.pathname.startsWith("/app")) {
      url.searchParams.set("storeId", nextId);
      navigateApp(`${url.pathname}?${url.searchParams.toString()}`);
      return;
    }
    // Outside /app there is no soft navigator — hard reload is intentional.
    window.location.reload();
  }

  if (!ready && stores.length === 0) {
    return (
      <span
        aria-hidden
        className="inline-block h-8 w-full rounded-lg border border-card-border/60 bg-card-border/20"
      />
    );
  }

  if (stores.length < 1) return null;

  return (
    <div className="w-full min-w-0">
      <MenuSelect
        size="compact"
        menuAlign="end"
        className="w-full min-w-0"
        label={t("app.selectStore")}
        value={storeId}
        options={stores.map((store) => ({
          value: store.id,
          label: store.name,
        }))}
        onChange={onStoreChange}
        disabled={stores.length < 2}
        leadingIcon={<StoreIcon />}
        placeholder={t("app.selectStore")}
      />
    </div>
  );
}

/** Prefer AppLanguageAction + AppStoreSelect stacked in the header. */
export function AppTopActions() {
  return <AppLanguageAction />;
}

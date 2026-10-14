"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType } from "react";
import { useEffect, useState } from "react";
import {
  AddNavIcon,
  DocumentNavIcon,
  ExpiryNavIcon,
  OrdersNavIcon,
} from "@/components/app-nav-icons";
import { useT } from "@/components/i18n-provider";
import { useAppSession } from "@/components/app-session-provider";
import { getStoredStoreId } from "@/lib/store-selection";

type Tab = {
  id: "expiry" | "add" | "document" | "orders";
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  match: (pathname: string) => boolean;
  badge?: number;
};

export function AppBottomNav() {
  const pathname = usePathname();
  const { t } = useT();
  const { homeUser } = useAppSession();
  const [storeId, setStoreId] = useState("");
  const [cartCount, setCartCount] = useState(0);
  const [navReady, setNavReady] = useState(false);

  useEffect(() => {
    function syncStoreId() {
      setStoreId(getStoredStoreId() ?? "");
    }
    syncStoreId();
    setNavReady(true);
    window.addEventListener("magazin:store-changed", syncStoreId);
    return () => window.removeEventListener("magazin:store-changed", syncStoreId);
  }, [pathname]);

  useEffect(() => {
    if (homeUser !== true || !storeId) {
      setCartCount(0);
      return;
    }

    let cancelled = false;
    async function loadCartCount() {
      try {
        const response = await fetch(
          `/api/buy-list?storeId=${encodeURIComponent(storeId)}&limit=1`,
          { credentials: "same-origin", cache: "no-store" },
        );
        if (!response.ok) return;
        const data = (await response.json()) as {
          pagination?: { total?: number };
        };
        if (!cancelled) {
          setCartCount(Math.max(0, Number(data.pagination?.total) || 0));
        }
      } catch {
        if (!cancelled) setCartCount(0);
      }
    }
    void loadCartCount();
    return () => {
      cancelled = true;
    };
  }, [homeUser, storeId, pathname]);

  const query = storeId ? `?storeId=${encodeURIComponent(storeId)}` : "";
  // Keep links disabled until after mount so SSR matches the first client paint.
  const disabled = !navReady || !storeId;

  const tabs: Tab[] = [
    {
      id: "expiry",
      href: `/app/expiry${query}`,
      label: t("app.navExpiry"),
      icon: ExpiryNavIcon,
      match: (path) => path.startsWith("/app/expiry"),
    },
    {
      id: "add",
      href: `/app/scan${query}`,
      label: t("app.navAdd"),
      icon: AddNavIcon,
      match: (path) =>
        path.startsWith("/app/scan") || path.startsWith("/app/add-product"),
    },
  ];

  if (homeUser === true) {
    tabs.push({
      id: "orders",
      href: `/app/orders${query}`,
      label: t("app.navOrders"),
      icon: OrdersNavIcon,
      match: (path) =>
        path.startsWith("/app/orders") || path.startsWith("/app/buy-list"),
      badge: cartCount > 0 ? cartCount : undefined,
    });
  } else if (homeUser === false) {
    tabs.push({
      id: "document",
      href: `/app/add-document${query}`,
      label: t("app.navDocument"),
      icon: DocumentNavIcon,
      match: (path) => path.startsWith("/app/add-document"),
    });
  }

  return (
    <nav
      aria-label={t("app.bottomNav")}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-card-border bg-background/95 backdrop-blur-sm supports-[backdrop-filter]:bg-background/90"
    >
      <div className="mx-auto grid min-h-[var(--app-bottom-nav-height)] min-w-0 max-w-lg grid-cols-3 px-2 pb-[calc(env(safe-area-inset-bottom,0px)+0.35rem)] pt-1">
        {tabs.map((tab) => {
          const active = tab.match(pathname);
          const className = `relative flex min-w-0 flex-col items-center justify-center gap-1 rounded-lg px-1 py-1 text-[11px] font-medium leading-none transition-colors ${
            disabled
              ? "pointer-events-none opacity-40"
              : active
                ? "text-primary"
                : "text-muted hover:text-foreground"
          }`;

          const content = (
            <>
              <span className="relative inline-flex">
                <tab.icon className="h-5 w-5" />
                {tab.badge != null ? (
                  <span className="absolute -right-2.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold leading-none text-primary-fg">
                    {tab.badge > 99 ? "99+" : tab.badge}
                  </span>
                ) : null}
              </span>
              <span className="max-w-full truncate">{tab.label}</span>
            </>
          );

          if (disabled) {
            return (
              <span key={tab.id} className={className}>
                {content}
              </span>
            );
          }

          return (
            <Link
              key={tab.id}
              href={tab.href}
              className={className}
              aria-current={active ? "page" : undefined}
              prefetch
            >
              {content}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

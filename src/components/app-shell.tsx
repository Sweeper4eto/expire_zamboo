"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AppBottomNav } from "@/components/app-bottom-nav";
import { useAppSession } from "@/components/app-session-provider";
import { registerAppSoftNavigate } from "@/lib/app-navigation";
import { clearStoredStoreId } from "@/lib/store-selection";

/** Routes available with zero assigned locations (homepage + support + billing). */
function isAllowedWithoutStore(pathname: string): boolean {
  if (pathname === "/app" || pathname === "/app/") return true;
  if (pathname === "/app/contact" || pathname.startsWith("/app/contact/")) {
    return true;
  }
  if (pathname === "/app/billing" || pathname.startsWith("/app/billing/")) {
    return true;
  }
  return false;
}

function RequireLocationGuard({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { ready, user, refresh } = useAppSession();
  const refreshAttempted = useRef(false);

  useEffect(() => {
    if (!ready || !user) return;

    if (user.stores.length > 0) {
      refreshAttempted.current = false;
      return;
    }

    if (isAllowedWithoutStore(pathname)) {
      clearStoredStoreId();
      refreshAttempted.current = false;
      return;
    }

    if (refreshAttempted.current) {
      clearStoredStoreId();
      router.replace("/app");
      return;
    }

    refreshAttempted.current = true;
    let cancelled = false;
    void (async () => {
      const stores = await refresh();
      if (cancelled) return;
      if (stores.length === 0) {
        clearStoredStoreId();
        router.replace("/app");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [ready, user, pathname, router, refresh]);

  return <>{children}</>;
}

export function AppShell({ children }: { children: ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    registerAppSoftNavigate({
      push: (path) => {
        router.push(path);
      },
      replace: (path) => {
        router.replace(path);
      },
    });
    return () => registerAppSoftNavigate(null);
  }, [router]);

  return (
    <>
      {/*
        min-h-svh + border-box so bottom-nav padding sits inside the viewport
        height. Plain pb-* on a content-sized shell made short pages scrollable
        by ~4rem and painted Android's scrollbar thumb on every /app screen.
      */}
      <div className="box-border min-h-svh min-w-0 max-w-[100vw] pb-[calc(var(--app-bottom-nav-frame)+env(safe-area-inset-bottom,0px))]">
        <RequireLocationGuard>{children}</RequireLocationGuard>
      </div>
      <AppBottomNav />
    </>
  );
}

"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useAppSession } from "@/components/app-session-provider";
import { replaceApp } from "@/lib/app-navigation";
import { getStoredStoreId, setStoredStoreId } from "@/lib/store-selection";

/**
 * Resolve the active store for /app pages from the URL, localStorage, or the
 * signed-in user's store list — and keep the URL in sync when possible.
 */
export function useAppStoreId(): { storeId: string; ready: boolean } {
  const searchParams = useSearchParams();
  const queryStoreId = searchParams.get("storeId")?.trim() ?? "";
  const { user, ready: sessionReady } = useAppSession();
  const [storeId, setStoreId] = useState(queryStoreId);
  const [ready, setReady] = useState(() => Boolean(queryStoreId));
  const urlSyncedForRef = useRef<string | null>(
    queryStoreId ? queryStoreId : null,
  );

  useEffect(() => {
    if (!sessionReady) {
      if (queryStoreId) {
        setStoreId(queryStoreId);
        setStoredStoreId(queryStoreId);
        urlSyncedForRef.current = queryStoreId;
        setReady(true);
      }
      return;
    }

    const stores = user?.stores ?? [];
    const validQuery =
      Boolean(queryStoreId) && stores.some((store) => store.id === queryStoreId);

    if (validQuery) {
      setStoreId(queryStoreId);
      setStoredStoreId(queryStoreId);
      urlSyncedForRef.current = queryStoreId;
      setReady(true);
      return;
    }

    const stored = getStoredStoreId();
    const validStored = stores.find((store) => store.id === stored);
    const resolved = validStored?.id ?? stores[0]?.id ?? "";

    setStoreId(resolved);
    setReady(true);

    if (!resolved) return;

    setStoredStoreId(resolved);

    const currentParam = new URL(window.location.href).searchParams.get(
      "storeId",
    );
    if (
      currentParam !== resolved &&
      urlSyncedForRef.current !== resolved
    ) {
      urlSyncedForRef.current = resolved;
      const url = new URL(window.location.href);
      url.searchParams.set("storeId", resolved);
      replaceApp(`${url.pathname}?${url.searchParams.toString()}`);
    }
  }, [sessionReady, user, queryStoreId]);

  return { storeId, ready };
}

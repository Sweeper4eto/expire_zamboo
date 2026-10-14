"use client";

import { useEffect } from "react";
import {
  CLIENT_COOKIE_NAME,
  MAX_AGE_SECONDS,
} from "@/lib/session-token";
import { isSignedOut } from "@/lib/client-session";

/**
 * On /app?__session=… (and once in sessionStorage), write the JS-readable
 * cookie phones accept on HTTP LAN, then strip the token from the URL.
 */
export function SessionClientBootstrap() {
  useEffect(() => {
    try {
      if (isSignedOut()) return;
      const url = new URL(window.location.href);
      const fromQuery = url.searchParams.get("__session")?.trim() ?? "";
      const fromStore = sessionStorage.getItem(CLIENT_COOKIE_NAME)?.trim() ?? "";
      const token = fromQuery || fromStore;
      if (!token) return;

      document.cookie = `${CLIENT_COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; Max-Age=${MAX_AGE_SECONDS}; SameSite=Lax`;
      sessionStorage.setItem(CLIENT_COOKIE_NAME, token);

      if (fromQuery) {
        url.searchParams.delete("__session");
        const clean = `${url.pathname}${url.search}${url.hash}`;
        window.history.replaceState({}, "", clean);
      }
    } catch {
      /* ignore */
    }
  }, []);

  return null;
}

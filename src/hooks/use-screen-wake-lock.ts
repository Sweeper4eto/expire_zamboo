"use client";

import { useEffect } from "react";

/**
 * Keeps the screen awake while `active` is true (Screen Wake Lock API).
 * No-ops when unsupported. Re-acquires after the page becomes visible again
 * (browsers release the lock when the tab is backgrounded).
 */
export function useScreenWakeLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    if (typeof navigator === "undefined" || !("wakeLock" in navigator)) return;

    let cancelled = false;
    let sentinel: WakeLockSentinel | null = null;

    async function acquire() {
      try {
        const lock = await navigator.wakeLock.request("screen");
        if (cancelled) {
          await lock.release().catch(() => undefined);
          return;
        }
        sentinel = lock;
        lock.addEventListener("release", () => {
          if (sentinel === lock) sentinel = null;
        });
      } catch {
        // Permission denied, low power mode, unsupported context — ignore.
      }
    }

    void acquire();

    function onVisibility() {
      if (document.visibilityState === "visible" && !sentinel) {
        void acquire();
      }
    }
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      void sentinel?.release().catch(() => undefined);
      sentinel = null;
    };
  }, [active]);
}

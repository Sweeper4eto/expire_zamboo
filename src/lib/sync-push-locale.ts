import type { MobileLocale } from "@/lib/client-locale";

/**
 * Persist the UI language onto all push subscriptions for the logged-in user.
 * No-ops when logged out (401) or when push is unused.
 */
export function syncPushLocale(locale: MobileLocale): void {
  if (typeof window === "undefined") return;
  void fetch("/api/push/locale", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ locale }),
    credentials: "same-origin",
  }).catch(() => {
    // Ignore network / auth errors — language still works in the UI.
  });
}
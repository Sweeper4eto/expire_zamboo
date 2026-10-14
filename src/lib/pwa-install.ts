const DISMISS_KEY = "expire365-pwa-install-dismissed";
const OFFER_KEY = "expire365-offer-pwa";
const OFFER_EVENT = "expire365-offer-pwa";

/** Soft dismiss: hide the install prompt for this long, then offer again if still not installed. */
export const PWA_INSTALL_DISMISS_MS = 7 * 24 * 60 * 60 * 1000;

export type BeforeInstallPromptEventLike = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

let deferredPrompt: BeforeInstallPromptEventLike | null = null;

export function setDeferredInstallPrompt(
  event: BeforeInstallPromptEventLike | null,
): void {
  deferredPrompt = event;
}

export function getDeferredInstallPrompt(): BeforeInstallPromptEventLike | null {
  return deferredPrompt;
}

export function clearDeferredInstallPrompt(): void {
  deferredPrompt = null;
}

export function isPwaInstalled(): boolean {
  if (typeof window === "undefined") return false;
  if (window.matchMedia("(display-mode: standalone)").matches) return true;
  if (window.matchMedia("(display-mode: fullscreen)").matches) return true;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return Boolean(nav.standalone);
}

export function isIosDevice(): boolean {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent.toLowerCase();
  const iOS = /iphone|ipad|ipod/.test(ua);
  const iPadOs =
    ua.includes("mac") && typeof document !== "undefined" && "ontouchend" in document;
  return iOS || iPadOs;
}

export function wasPwaInstallDismissed(
  nowMs: number = Date.now(),
): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = window.localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;

    const dismissedAt = Number(raw);
    // Legacy forever flag ("1") — clear so we can re-offer under the week rule.
    if (!Number.isFinite(dismissedAt) || dismissedAt <= 0) {
      window.localStorage.removeItem(DISMISS_KEY);
      return false;
    }

    if (nowMs - dismissedAt >= PWA_INSTALL_DISMISS_MS) {
      window.localStorage.removeItem(DISMISS_KEY);
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export function dismissPwaInstallPrompt(nowMs: number = Date.now()): void {
  try {
    window.localStorage.setItem(DISMISS_KEY, String(nowMs));
  } catch {
    // ignore quota / private mode
  }
}

export function markPwaInstallOffered(): void {
  try {
    window.sessionStorage.setItem(OFFER_KEY, "1");
  } catch {
    // ignore
  }
  // The install dialog is mounted once in the root layout and does not
  // remount on client-side navigation (e.g. after login), so it needs an
  // explicit nudge to re-check the flag we just set.
  window.dispatchEvent(new Event(OFFER_EVENT));
}

export function consumePwaInstallOffer(): boolean {
  try {
    if (window.sessionStorage.getItem(OFFER_KEY) !== "1") return false;
    window.sessionStorage.removeItem(OFFER_KEY);
    return true;
  } catch {
    return false;
  }
}

export function shouldOfferPwaInstall(nowMs: number = Date.now()): boolean {
  return !isPwaInstalled() && !wasPwaInstallDismissed(nowMs);
}

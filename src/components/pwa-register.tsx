"use client";

import { useEffect } from "react";
import {
  clearDeferredInstallPrompt,
  setDeferredInstallPrompt,
  type BeforeInstallPromptEventLike,
} from "@/lib/pwa-install";

function isLanOrLocalHost(hostname: string): boolean {
  if (hostname === "localhost" || hostname === "127.0.0.1") return true;
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true;
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true;
  return false;
}

async function clearServiceWorkersAndCaches() {
  if ("serviceWorker" in navigator) {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(regs.map((reg) => reg.unregister()));
  }
  if ("caches" in window) {
    const keys = await caches.keys();
    await Promise.all(keys.map((key) => caches.delete(key)));
  }
}

export function PwaRegister() {
  useEffect(() => {
    // LAN / localhost phone testing: a SW caches old HTML and breaks login,
    // hydration, and redirects. Only register on a real deployed host.
    if (typeof window !== "undefined" && isLanOrLocalHost(window.location.hostname)) {
      void clearServiceWorkersAndCaches();
      return;
    }

    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/sw.js").catch(() => {
        // Service worker is optional; app works without it.
      });
    }

    function onBeforeInstall(event: Event) {
      event.preventDefault();
      setDeferredInstallPrompt(event as BeforeInstallPromptEventLike);
    }

    function onInstalled() {
      clearDeferredInstallPrompt();
    }

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  return null;
}

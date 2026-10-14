"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useT } from "@/components/i18n-provider";
import { isIosDevice, isPwaInstalled } from "@/lib/pwa-install";
import { syncPushLocale } from "@/lib/sync-push-locale";
import type { MobileLocale } from "@/lib/client-locale";

type PushState =
  | "unsupported"
  | "iosNeedsInstall"
  | "unconfigured"
  | "default"
  | "denied"
  | "enabled"
  | "loading";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from(raw, (char) => char.charCodeAt(0));
}

function BellIcon({ className = "size-7" }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M7 9a5 5 0 0 1 10 0c0 4 1.5 5.5 1.5 5.5H5.5S7 13 7 9Z" />
      <path d="M10 19a2 2 0 0 0 4 0" />
      <circle cx="17.5" cy="6.5" r="2.25" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function PushNotifications() {
  const { t, locale } = useT();
  const [state, setState] = useState<PushState>("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function detect() {
      if (typeof window === "undefined") return;

      // iOS Safari never exposes PushManager in a regular browser tab —
      // it only becomes available once the site is installed to the Home
      // Screen and opened from there (iOS 16.4+). Show install instructions
      // instead of silently hiding the whole section.
      if (isIosDevice() && !isPwaInstalled()) {
        if (!cancelled) setState("iosNeedsInstall");
        return;
      }

      if (
        !("serviceWorker" in navigator) ||
        !("PushManager" in window) ||
        !("Notification" in window)
      ) {
        if (!cancelled) setState("unsupported");
        return;
      }

      const keyResponse = await fetch("/api/push/vapid-public-key");
      const keyData = (await keyResponse.json()) as {
        configured?: boolean;
      };
      if (cancelled) return;

      if (!keyData.configured) {
        setState("unconfigured");
        return;
      }

      if (Notification.permission === "denied") {
        setState("denied");
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();
      if (cancelled) return;

      setState(existing ? "enabled" : "default");
    }

    void detect();
    return () => {
      cancelled = true;
    };
  }, []);

  // Keep push digests in the same language as the UI (also covers language
  // changes made while already subscribed).
  useEffect(() => {
    if (state !== "enabled") return;
    if (locale !== "en" && locale !== "bg") return;
    syncPushLocale(locale as MobileLocale);
  }, [state, locale]);

  async function enableNotifications() {
    setError("");
    setState("loading");

    try {
      const keyResponse = await fetch("/api/push/vapid-public-key");
      const keyData = (await keyResponse.json()) as {
        configured?: boolean;
        publicKey?: string | null;
      };
      if (!keyData.configured || !keyData.publicKey) {
        setState("unconfigured");
        return;
      }

      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "default");
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(
            keyData.publicKey,
          ) as BufferSource,
        });
      }

      const json = subscription.toJSON();
      if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
        throw new Error("Invalid subscription");
      }

      const response = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: json.endpoint,
          keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
          locale,
        }),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(data?.error ?? t("push.subscribeError"));
      }

      setState("enabled");
    } catch {
      setError(t("push.subscribeError"));
      setState("default");
    }
  }

  async function disableNotifications() {
    setError("");
    setState("loading");

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        const endpoint = subscription.endpoint;
        await fetch("/api/push/unsubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint }),
        });
        await subscription.unsubscribe();
      }
      setState("default");
    } catch {
      setError(t("push.unsubscribeError"));
      setState("enabled");
    }
  }

  if (state === "loading") {
    return (
      <section className="mb-2 flex items-center gap-3 rounded-2xl border border-card-border bg-transparent px-3 py-2.5 opacity-60">
        <span
          aria-hidden
          className="flex size-9 shrink-0 items-center justify-center rounded-full border border-primary/45 text-primary"
        >
          <BellIcon className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-foreground">
            {t("push.title")}
          </h2>
        </div>
        <span
          aria-hidden
          className="relative h-7 w-12 shrink-0 rounded-full border border-card-border bg-transparent"
        >
          <span className="absolute left-0.5 top-0.5 size-6 rounded-full bg-white" />
        </span>
      </section>
    );
  }

  if (state === "unsupported") return null;

  const canToggle = state === "default" || state === "enabled";
  const showToggle =
    state !== "iosNeedsInstall" &&
    state !== "denied" &&
    state !== "unconfigured";

  return (
    <section className="mb-2 flex items-center gap-3 rounded-2xl border border-card-border bg-transparent px-3 py-2.5">
      <span
        aria-hidden
        className="flex size-9 shrink-0 items-center justify-center rounded-full border border-primary/45 text-primary"
      >
        <BellIcon className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <h2 className="text-sm font-semibold leading-snug text-foreground">
          {t("push.title")}
        </h2>

        <Link
          href="/app/settings/notifications"
          className="mt-0.5 inline-block text-xs font-semibold text-primary"
        >
          {t("push.customize")} →
        </Link>

        {state === "iosNeedsInstall" ? (
          <p className="mt-2 rounded-lg border border-card-border bg-transparent px-2.5 py-1.5 text-xs text-foreground">
            {t("push.iosInstallRequired")}
          </p>
        ) : null}

        {state === "denied" ? (
          <p className="mt-2 text-xs text-warning-fg">{t("push.denied")}</p>
        ) : null}

        {state === "unconfigured" ? (
          <p className="mt-2 text-xs text-warning-fg">
            {t("errors.pushNotConfigured")}
          </p>
        ) : null}

        {error ? <p className="mt-2 text-xs text-danger">{error}</p> : null}
      </div>

      {showToggle ? (
        <button
          type="button"
          role="switch"
          aria-checked={state === "enabled"}
          aria-label={state === "enabled" ? t("push.disable") : t("push.enable")}
          disabled={!canToggle}
          onClick={() =>
            void (state === "enabled" ? disableNotifications() : enableNotifications())
          }
          className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
            state === "enabled"
              ? "bg-primary"
              : "border border-card-border bg-transparent"
          }`}
        >
          <span
            aria-hidden
            className={`absolute top-0.5 size-6 rounded-full bg-white shadow-sm transition-transform ${
              state === "enabled" ? "left-5" : "left-0.5"
            }`}
          />
        </button>
      ) : null}
    </section>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { appButtonNeutralFull } from "@/lib/app-ui";
import { CheckIcon } from "@/components/app-nav-icons";
import { useT } from "@/components/i18n-provider";
import { useViewportInsets } from "@/hooks/use-viewport-insets";
import { markPwaInstallOffered, shouldOfferPwaInstall } from "@/lib/pwa-install";
import {
  dismissWhatsNewOnServer,
  getLocalWhatsNewSeenIdsPendingMigration,
  markLocalWhatsNewSeenMigrated,
  markWhatsNewSeen,
  type WhatsNewPublicItem,
} from "@/lib/whats-new";

function SparkleIcon({ className = "size-4" }: { className?: string }) {
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
      <path d="M12 3v3" />
      <path d="M12 18v3" />
      <path d="M3 12h3" />
      <path d="M18 12h3" />
      <path d="m5.6 5.6 2.1 2.1" />
      <path d="m16.3 16.3 2.1 2.1" />
      <path d="m5.6 18.4 2.1-2.1" />
      <path d="m16.3 7.7 2.1-2.1" />
    </svg>
  );
}

function CheckDotIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <circle cx="12" cy="12" r="9" className="opacity-35" />
      <path d="m8.5 12.2 2.4 2.4 4.6-4.8" />
    </svg>
  );
}

type Props = {
  ready?: boolean;
};

export function WhatsNewDialog({ ready = true }: Props) {
  const { t } = useT();
  const { offsetTop, keyboardInset } = useViewportInsets();
  const [items, setItems] = useState<WhatsNewPublicItem[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;

    async function load() {
      try {
        const pendingLocal = getLocalWhatsNewSeenIdsPendingMigration();
        if (pendingLocal.length > 0) {
          const migrated = await dismissWhatsNewOnServer(pendingLocal);
          if (migrated) markLocalWhatsNewSeenMigrated();
        }

        const response = await fetch("/api/whats-new");
        if (!response.ok) return;
        const data = (await response.json()) as { items?: WhatsNewPublicItem[] };
        if (cancelled) return;
        const next = data.items ?? [];
        setItems(next);
        if (next.length > 0) setOpen(true);
        else if (shouldOfferPwaInstall()) markPwaInstallOffered();
      } catch {
        if (!cancelled && shouldOfferPwaInstall()) markPwaInstallOffered();
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [ready]);

  function dismiss() {
    const ids = items.map((item) => item.id);
    markWhatsNewSeen(items);
    void dismissWhatsNewOnServer(ids).then((ok) => {
      if (ok) markLocalWhatsNewSeenMigrated();
    });
    setOpen(false);
    if (shouldOfferPwaInstall()) markPwaInstallOffered();
  }

  if (!open || items.length === 0) return null;


  return (
    <div
      className="fixed inset-x-0 z-[75] flex items-end justify-center bg-black/60 px-4 pb-[max(1rem,env(safe-area-inset-bottom,0px))] pt-6 sm:items-center sm:pb-6"
      style={{ top: offsetTop, bottom: keyboardInset }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="whats-new-title"
      onClick={dismiss}
    >
      <div
        className="relative w-full max-w-[22rem] overflow-hidden rounded-2xl border border-card-border bg-background px-5 pb-5 pt-6 shadow-[0_20px_50px_rgba(0,0,0,0.5)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-36 bg-[radial-gradient(ellipse_at_50%_0%,rgb(52_211_153/0.22),transparent_65%)]"
        />

        <div className="relative flex justify-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/45 bg-primary/10 px-2.5 py-1 text-[0.65rem] font-bold uppercase tracking-[0.12em] text-primary">
            <SparkleIcon className="size-3.5" />
            {t("whatsNew.badge")}
          </span>
        </div>

        <div className="relative mt-4 flex justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/icons/icon-192.png?v=10"
            alt=""
            width={88}
            height={88}
            className="size-[5.5rem] object-contain"
            decoding="async"
          />
        </div>

        <h2
          id="whats-new-title"
          className="relative mt-3 text-center text-[1.35rem] font-semibold leading-tight text-foreground"
        >
          {t("whatsNew.title")}
        </h2>
        <p className="relative mt-2 text-center text-sm leading-relaxed text-muted">
          {t("whatsNew.headline")}
        </p>

        <ul className="relative mt-5 space-y-3">
          {items.map((item) => (
            <li key={item.id} className="flex items-start gap-2.5">
              <span className="mt-0.5 shrink-0 text-primary">
                <CheckDotIcon />
              </span>
              {item.href ? (
                <Link
                  href={item.href}
                  onClick={dismiss}
                  className="text-sm leading-snug text-primary underline-offset-2 hover:underline"
                >
                  {item.title}
                </Link>
              ) : (
                <span className="text-sm leading-snug text-foreground/90">
                  {item.title}
                </span>
              )}
            </li>
          ))}
        </ul>

        <div className="relative mt-6 flex flex-col gap-2.5">
          <button
            type="button"
            onClick={dismiss}
            className={`${appButtonNeutralFull} gap-1.5`}
          >
            <CheckIcon className="size-4 shrink-0" />
            {t("whatsNew.gotIt")}
          </button>
        </div>
      </div>
    </div>
  );
}

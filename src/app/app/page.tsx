"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { LoadingSpinnerBlock } from "@/components/loading-spinner";
import { MobilePageHeader, appPageClassName } from "@/components/mobile-page-header";
import { PushNotifications } from "@/components/push-notifications";
import { WhatsNewDialog } from "@/components/whats-new-dialog";
import { useT } from "@/components/i18n-provider";
import { useAppSession } from "@/components/app-session-provider";
import { isSignedOut, logoutSession } from "@/lib/client-session";
import { getStoredStoreId, setStoredStoreId, clearStoredStoreId } from "@/lib/store-selection";

type Store = { id: string; name: string; active: boolean };

function ChevronIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

function LogoutIcon({ className = "size-4" }: { className?: string }) {
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
      <path d="M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4" />
      <path d="M15 16l4-4-4-4" />
      <path d="M19 12H10" />
    </svg>
  );
}

function HeadsetIcon({ className = "size-7" }: { className?: string }) {
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
      <path d="M4 13v-1a8 8 0 0 1 16 0v1" />
      <path d="M4 13v3a2 2 0 0 0 2 2h1v-5H6a2 2 0 0 0-2 2Z" />
      <path d="M20 13v3a2 2 0 0 1-2 2h-1v-5h1a2 2 0 0 1 2 2Z" />
      <path d="M15 19h-2a1 1 0 0 0-1 1v0a1 1 0 0 0 1 1h1" />
    </svg>
  );
}

function TeamIcon({ className = "size-7" }: { className?: string }) {
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
      <circle cx="9" cy="8" r="3" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M3.5 19a5.5 5.5 0 0 1 11 0" />
      <path d="M14 19a4.5 4.5 0 0 1 6.5-4" />
    </svg>
  );
}

function ScheduleHomeIcon({ className = "size-7" }: { className?: string }) {
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
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18" />
      <path d="M8 3v4" />
      <path d="M16 3v4" />
      <path d="M8 14h3" />
      <path d="M14 14h2" />
    </svg>
  );
}

function BillingHomeIcon({ className = "size-7" }: { className?: string }) {
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
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <path d="M3 10h18" />
      <path d="M7 15h4" />
    </svg>
  );
}

function HomeLinkCard({
  href,
  title,
  icon,
}: {
  href: string;
  title: string;
  icon: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="mb-2 flex items-center gap-3 rounded-2xl border border-card-border bg-transparent px-3 py-2.5 transition-colors hover:border-primary/40"
    >
      <span
        aria-hidden
        className="flex size-9 shrink-0 items-center justify-center rounded-full border border-primary/45 text-primary"
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1 text-left text-sm font-semibold leading-snug text-foreground">
        {title}
      </span>
      <span aria-hidden className="shrink-0 text-primary">
        <ChevronIcon />
      </span>
    </Link>
  );
}

export default function AppHomePage() {
  const router = useRouter();
  const { t } = useT();
  const { refresh: refreshSession } = useAppSession();
  const [stores, setStores] = useState<Store[]>([]);
  const [username, setUsername] = useState("");
  const [isOwner, setIsOwner] = useState(false);
  const [billingEnabled, setBillingEnabled] = useState(false);
  const [schedulePublic, setSchedulePublic] = useState(false);
  const [bootstrapped, setBootstrapped] = useState(false);
  const [sessionMissing, setSessionMissing] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      // Ensure LAN JS cookie exists before /me (HttpOnly Set-Cookie is often dropped).
      try {
        const url = new URL(window.location.href);
        const token = url.searchParams.get("__session")?.trim();
        if (token && !isSignedOut()) {
          const { CLIENT_COOKIE_NAME, MAX_AGE_SECONDS } = await import(
            "@/lib/session-token"
          );
          document.cookie = `${CLIENT_COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; Max-Age=${MAX_AGE_SECONDS}; SameSite=Lax`;
          sessionStorage.setItem(CLIENT_COOKIE_NAME, token);
        }
      } catch {
        /* ignore */
      }

      async function fetchMe() {
        try {
          const response = await fetch("/api/auth/me", {
            credentials: "same-origin",
            cache: "no-store",
            signal: AbortSignal.timeout(12_000),
          });
          return await response.json().catch(() => ({}));
        } catch {
          return {};
        }
      }

      let data = await fetchMe();
      if (cancelled) return;

      if (!data.user) {
        for (const wait of [100, 300, 600]) {
          await new Promise((r) => setTimeout(r, wait));
          if (cancelled) return;
          data = await fetchMe();
          if (data.user) break;
        }
      }

      if (!data.user) {
        setSessionMissing(true);
        setBootstrapped(true);
        return;
      }

      setSessionMissing(false);
      setUsername(data.user.username);
      const owner = data.user.clientRole === "OWNER";
      setIsOwner(owner);
      setSchedulePublic(data.user.scheduleAccess === "public");
      setBillingEnabled(false);

      // Paint home immediately from /me — never block on billing or session refresh
      // (slow/hanging LAN fetches left owners on spinner + Contact only).
      const list: Store[] = data.user.stores ?? [];
      setStores(list);
      const stored = getStoredStoreId();
      const valid = list.find((store) => store.id === stored);
      const nextId = valid?.id ?? list[0]?.id ?? "";
      if (nextId) {
        setStoredStoreId(nextId);
      } else {
        clearStoredStoreId();
      }
      setBootstrapped(true);

      void refreshSession();

      if (owner) {
        void (async () => {
          try {
            const billingRes = await fetch("/api/billing", {
              credentials: "same-origin",
              cache: "no-store",
            });
            if (!cancelled && billingRes.ok) {
              const billing = (await billingRes.json()) as { enabled?: boolean };
              setBillingEnabled(Boolean(billing.enabled));
            }
          } catch {
            /* ignore — home still works without billing card */
          }
        })();
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [router, refreshSession]);

  async function logout() {
    await logoutSession();
    router.push("/login");
    router.refresh();
  }

  const greetingTemplate = t("app.greeting", { username: "\u0000" });
  const [greetingBefore, greetingAfter = ""] = greetingTemplate.split("\u0000");

  return (
    <div className={`${appPageClassName} flex flex-col`}>
      <MobilePageHeader className="mb-1" />

      <div className="mb-6 flex items-start justify-between gap-3">
        <h1 className="min-w-0 flex-1 text-[1.65rem] font-semibold leading-tight tracking-tight text-foreground">
          {bootstrapped ? (
            <>
              <span className="block text-foreground">{greetingBefore.trimEnd()}</span>
              <span className="block text-primary">{username}</span>
              {greetingAfter ? (
                <span className="block text-foreground">{greetingAfter}</span>
              ) : null}
            </>
          ) : null}
        </h1>
        <button
          type="button"
          onClick={() => void logout()}
          className="mt-1 inline-flex shrink-0 items-center gap-1.5 text-sm font-medium text-primary transition-opacity hover:opacity-80"
        >
          <LogoutIcon />
          <span>{t("common.logout")}</span>
        </button>
      </div>

      <div>
        {!bootstrapped ? (
          <LoadingSpinnerBlock wrapperClassName="flex justify-center py-6" />
        ) : sessionMissing ? (
          <p className="mb-3 rounded-2xl border border-danger-border bg-danger/10 p-4 text-sm text-error">
            Session not found.{" "}
            <Link className="font-medium underline" href="/login">
              {t("auth.login")}
            </Link>
          </p>
        ) : stores.length === 0 ? (
          <p className="mb-3 rounded-2xl bg-warning-bg p-4 text-sm text-warning-fg">
            {t("app.noStores")}
          </p>
        ) : null}

        {bootstrapped && isOwner && !sessionMissing && stores.length > 0 ? (
          <HomeLinkCard
            href="/app/team"
            title={t("app.team")}
            icon={<TeamIcon className="size-5" />}
          />
        ) : null}

        {bootstrapped &&
        schedulePublic &&
        !sessionMissing &&
        stores.length > 0 ? (
          <HomeLinkCard
            href="/app/schedule"
            title={t("app.schedule")}
            icon={<ScheduleHomeIcon className="size-5" />}
          />
        ) : null}

        {bootstrapped && isOwner && billingEnabled && !sessionMissing ? (
          <HomeLinkCard
            href="/app/billing"
            title={t("app.billing")}
            icon={<BillingHomeIcon className="size-5" />}
          />
        ) : null}

        {bootstrapped && !sessionMissing ? (
          <HomeLinkCard
            href="/app/contact"
            title={t("app.contact")}
            icon={<HeadsetIcon className="size-5" />}
          />
        ) : null}

        <PushNotifications />
        <WhatsNewDialog ready={bootstrapped && !sessionMissing} />
      </div>

      <footer className="mt-6 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 border-t border-card-border pt-4 text-sm">
        <Link
          href="/terms"
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          {t("home.termsLink")}
        </Link>
        <Link
          href="/privacy"
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          {t("home.privacyLink")}
        </Link>
      </footer>
    </div>
  );
}

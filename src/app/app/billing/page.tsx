"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { SecondaryButton } from "@/components/auth-forms";
import { BackArrowIcon } from "@/components/app-nav-icons";
import { LoadingSpinnerBlock } from "@/components/loading-spinner";
import { MobilePageHeader } from "@/components/mobile-page-header";
import { useT } from "@/components/i18n-provider";
import {
  appButtonPrimaryFull,
  appChromeInset,
  appListInset,
  appPageShell,
} from "@/lib/app-ui";
import { navigateApp } from "@/lib/app-navigation";

type FeeStore = { id: string; name: string; monthlyFee: number };

type BillingMonth = {
  year: number;
  month: number;
  paid: boolean;
  amount: number | null;
};

type BillingPayload = {
  enabled: boolean;
  standing: "current" | "behind1" | "behind2plus" | "exempt";
  unpaidMonths?: number;
  expectedAmount: number;
  activeStoreCount: number;
  locationsFeeTotal: number;
  currentMonthPaid: boolean;
  currentYear?: number;
  currentMonth?: number;
  feeBreakdown?: FeeStore[];
  months: BillingMonth[];
};

function formatEuro(amount: number): string {
  const rounded = Math.round(amount * 100) / 100;
  return Number.isInteger(rounded) ? `€${rounded}` : `€${rounded.toFixed(2)}`;
}

function CheckIcon({ className = "size-5" }: { className?: string }) {
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
      <circle cx="12" cy="12" r="9" className="opacity-40" />
      <path d="m8.5 12.2 2.4 2.4 4.6-4.8" />
    </svg>
  );
}

function WarnIcon({ className = "size-5" }: { className?: string }) {
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
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
      <path d="M10.3 4.3 2.5 18a2 2 0 0 0 1.7 3h15.6a2 2 0 0 0 1.7-3L13.7 4.3a2 2 0 0 0-3.4 0Z" />
    </svg>
  );
}

export default function BillingPage() {
  const { t, monthName } = useT();
  const [data, setData] = useState<BillingPayload | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const response = await fetch("/api/billing");
        if (response.status === 403) {
          navigateApp("/app");
          return;
        }
        if (!response.ok) {
          throw new Error("load failed");
        }
        const json = (await response.json()) as BillingPayload;
        if (cancelled) return;
        if (!json.enabled) {
          navigateApp("/app");
          return;
        }
        setData(json);
      } catch {
        if (!cancelled) setError(t("billing.loadFailed"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [t]);

  const standing = data?.standing ?? "current";
  const statusTone =
    standing === "behind2plus"
      ? "border-danger/50 text-danger"
      : standing === "behind1"
        ? "border-warning-fg/40 text-warning-fg"
        : "border-primary/45 text-primary";

  const statusTitle =
    standing === "behind2plus"
      ? t("billing.statusOverdue")
      : standing === "behind1"
        ? t("billing.statusDue")
        : t("billing.statusUpToDate");

  const statusHint =
    data && standing === "current" && data.currentMonthPaid
      ? t("billing.monthPaid", {
          month: monthName(data.currentMonth ?? 1),
          year: String(data.currentYear ?? ""),
        })
      : data && standing === "current" && !data.currentMonthPaid
        ? t("billing.monthOpen", {
            month: monthName(data.currentMonth ?? 1),
            year: String(data.currentYear ?? ""),
          })
        : data && standing === "behind1"
          ? t("billing.behindOneHint")
          : data && standing === "behind2plus"
            ? t("billing.behindManyHint")
            : "";

  const feeParts =
    data?.feeBreakdown?.map((s) => formatEuro(s.monthlyFee)).join(" + ") ?? "";

  return (
    <div className={`${appPageShell} ${appChromeInset} pb-8 pt-2`}>
      <MobilePageHeader className="mb-2" />
      <h1 className={`${appListInset} text-2xl font-semibold text-foreground`}>
        {t("billing.title")}
      </h1>
      <p className={`${appListInset} mt-1 text-sm text-muted`}>
        {t("billing.subtitle")}
      </p>

      {loading ? (
        <LoadingSpinnerBlock wrapperClassName="flex justify-center py-10" />
      ) : error ? (
        <p className="mt-4 rounded-2xl border border-danger-border bg-danger/10 p-4 text-sm text-error">
          {error}
        </p>
      ) : data ? (
        <div className={`${appListInset} mt-4 space-y-3`}>
          <div
            className={`rounded-2xl border border-card-border border-l-4 px-3.5 py-3 ${statusTone}`}
          >
            <div className="flex items-start gap-2.5">
              {standing === "current" ? (
                <CheckIcon className="mt-0.5 size-5 shrink-0" />
              ) : (
                <WarnIcon className="mt-0.5 size-5 shrink-0" />
              )}
              <div className="min-w-0">
                <p className="text-sm font-semibold">{statusTitle}</p>
                {statusHint ? (
                  <p className="mt-0.5 text-sm text-foreground/85">{statusHint}</p>
                ) : null}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-card-border px-3.5 py-3">
            <p className="text-xs font-medium text-muted">
              {t("billing.thisMonth")}
            </p>
            <p className="mt-1 text-3xl font-semibold text-foreground">
              {formatEuro(data.expectedAmount)}
            </p>
            <p className="mt-1 text-xs text-muted">
              {t("billing.locationsFee", {
                count: String(data.activeStoreCount),
                breakdown: feeParts || formatEuro(data.locationsFeeTotal),
              })}
            </p>
          </div>

          <div>
            <h2 className="mb-2 text-sm font-semibold text-foreground">
              {t("billing.history")}
            </h2>
            <div className="max-h-[min(22rem,50vh)] space-y-0 overflow-y-auto overscroll-y-contain rounded-2xl border border-card-border">
              {data.months.length === 0 ? (
                <p className="px-3 py-4 text-sm text-muted">
                  {t("billing.historyEmpty")}
                </p>
              ) : (
                data.months.map((row) => (
                  <div
                    key={`${row.year}-${row.month}`}
                    className="flex items-center justify-between gap-3 border-b border-card-border px-3 py-2.5 last:border-b-0"
                  >
                    <span className="text-sm text-foreground">
                      {monthName(row.month)} {row.year}
                    </span>
                    <span
                      className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                        row.paid
                          ? "border-primary/50 text-primary"
                          : "border-card-border text-muted"
                      }`}
                    >
                      {row.paid ? t("billing.paid") : t("billing.due")}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          <Link
            href="/app/contact?topic=billing"
            className={`${appButtonPrimaryFull} mt-1`}
          >
            {t("billing.contact")}
          </Link>

          <div className="pt-1">
            <SecondaryButton
              onClick={() => navigateApp("/app")}
              icon={<BackArrowIcon className="size-4 shrink-0" />}
            >
              {t("common.back")}
            </SecondaryButton>
          </div>
        </div>
      ) : null}
    </div>
  );
}

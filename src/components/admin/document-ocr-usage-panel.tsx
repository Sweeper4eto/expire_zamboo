"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  AdminField,
  adminInputClass,
  adminSearchInputClass,
} from "@/components/admin/admin-ui";
import { LoadingSpinnerBlock } from "@/components/loading-spinner";
import { SearchField } from "@/components/search-field";
import { useT } from "@/components/i18n-provider";

/** Must match DOCUMENT_OCR_USAGE_TIMEZONE default (day buckets on server). */
const OCR_USAGE_DISPLAY_TZ = "Europe/Sofia";

type UsageRow = {
  userId: string;
  username: string;
  clientId: string | null;
  clientName: string | null;
  homeUser: boolean;
  scanCount: number;
  lastScanAt: string;
};

type DailyRow = { day: string; count: number };

type PeriodSummaries = {
  days7: number;
  days14: number;
  days30: number;
};

type PeriodPreset = "7" | "14" | "30" | "custom";

function ymdLocal(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function rangeForPreset(preset: Exclude<PeriodPreset, "custom">): {
  from: string;
  to: string;
} {
  const days = preset === "7" ? 6 : preset === "14" ? 13 : 29;
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - days);
  return { from: ymdLocal(from), to: ymdLocal(to) };
}

export function DocumentOcrUsagePanel() {
  const { t, dateLocale } = useT();
  const initial = rangeForPreset("7");
  const [rows, setRows] = useState<UsageRow[]>([]);
  const [daily, setDaily] = useState<DailyRow[]>([]);
  const [summaries, setSummaries] = useState<PeriodSummaries>({
    days7: 0,
    days14: 0,
    days30: 0,
  });
  const [totalScans, setTotalScans] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [preset, setPreset] = useState<PeriodPreset>("7");
  const [dateFrom, setDateFrom] = useState(initial.from);
  const [dateTo, setDateTo] = useState(initial.to);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [reloadToken, setReloadToken] = useState(0);

  const applyPreset = useCallback((next: Exclude<PeriodPreset, "custom">) => {
    const range = rangeForPreset(next);
    setPreset(next);
    setDateFrom(range.from);
    setDateTo(range.to);
    setReloadToken((n) => n + 1);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
      if (query.trim()) params.set("q", query.trim());
      const response = await fetch(
        `/api/admin/document-ocr-usage?${params.toString()}`,
      );
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setError(data?.error ?? t("errors.pageLoadFailed"));
        setRows([]);
        setDaily([]);
        setTotalScans(0);
        return;
      }
      setRows((data?.rows ?? []) as UsageRow[]);
      setDaily((data?.daily ?? []) as DailyRow[]);
      setTotalScans(Number(data?.totalScans ?? 0));
      setSummaries({
        days7: Number(data?.summaries?.days7 ?? 0),
        days14: Number(data?.summaries?.days14 ?? 0),
        days30: Number(data?.summaries?.days30 ?? 0),
      });
    } catch {
      setError(t("errors.networkError"));
      setRows([]);
      setDaily([]);
      setTotalScans(0);
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, query, t]);

  useEffect(() => {
    void load();
  }, [load, reloadToken]);

  function onSearch(event: FormEvent) {
    event.preventDefault();
    setPreset("custom");
    setQuery(search);
    setReloadToken((n) => n + 1);
  }

  const formatWhen = useMemo(
    () => (iso: string) => {
      try {
        return new Date(iso).toLocaleString(dateLocale, {
          dateStyle: "medium",
          timeStyle: "short",
          timeZone: OCR_USAGE_DISPLAY_TZ,
        });
      } catch {
        return iso;
      }
    },
    [dateLocale],
  );

  const formatDay = useMemo(
    () => (day: string) => {
      try {
        const [y, m, d] = day.split("-").map(Number);
        return new Date(y, m - 1, d).toLocaleDateString(dateLocale, {
          weekday: "short",
          day: "numeric",
          month: "short",
        });
      } catch {
        return day;
      }
    },
    [dateLocale],
  );

  const maxDaily = useMemo(
    () => Math.max(1, ...daily.map((row) => row.count)),
    [daily],
  );

  const presetButtonClass = (id: PeriodPreset) =>
    `rounded-xl border px-3 py-2 text-sm font-semibold transition-colors ${
      preset === id
        ? "border-primary text-primary bg-selected"
        : "border-card-border text-foreground hover:bg-selected/40"
    }`;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-foreground">
          {t("admin.documentOcrUsage")}
        </h2>
        <p className="mt-1 text-sm text-muted">
          {t("admin.documentOcrUsageHint")}
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <button
          type="button"
          onClick={() => applyPreset("7")}
          className={`${presetButtonClass("7")} text-left`}
        >
          <span className="block text-xs font-medium text-muted">
            {t("admin.documentOcrUsagePeriod7")}
          </span>
          <span className="mt-0.5 block text-xl tabular-nums text-foreground">
            {summaries.days7}
          </span>
        </button>
        <button
          type="button"
          onClick={() => applyPreset("14")}
          className={`${presetButtonClass("14")} text-left`}
        >
          <span className="block text-xs font-medium text-muted">
            {t("admin.documentOcrUsagePeriod14")}
          </span>
          <span className="mt-0.5 block text-xl tabular-nums text-foreground">
            {summaries.days14}
          </span>
        </button>
        <button
          type="button"
          onClick={() => applyPreset("30")}
          className={`${presetButtonClass("30")} text-left`}
        >
          <span className="block text-xs font-medium text-muted">
            {t("admin.documentOcrUsagePeriod30")}
          </span>
          <span className="mt-0.5 block text-xl tabular-nums text-foreground">
            {summaries.days30}
          </span>
        </button>
      </div>

      <form
        onSubmit={onSearch}
        className="flex flex-wrap items-end gap-3 rounded-xl border border-card-border bg-card p-3"
      >
        <AdminField label={t("admin.dateFrom")}>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => {
              setPreset("custom");
              setDateFrom(e.target.value);
            }}
            className={adminInputClass}
          />
        </AdminField>
        <AdminField label={t("admin.dateTo")}>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => {
              setPreset("custom");
              setDateTo(e.target.value);
            }}
            className={adminInputClass}
          />
        </AdminField>
        <div className="min-w-[12rem] flex-1">
          <SearchField
            value={search}
            onChange={setSearch}
            placeholder={t("admin.documentOcrUsageSearch")}
            inputClassName={adminSearchInputClass}
          />
        </div>
        <button
          type="submit"
          className="rounded-xl border border-card-border px-3 py-2 text-sm font-semibold text-foreground hover:bg-selected/40"
        >
          {t("admin.refresh")}
        </button>
      </form>

      <p className="text-sm text-muted">
        {t("admin.documentOcrUsageTotal", { count: String(totalScans) })}
      </p>

      {error ? (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}

      {loading ? (
        <LoadingSpinnerBlock />
      ) : (
        <>
          <section className="space-y-2">
            <h3 className="text-sm font-semibold text-foreground">
              {t("admin.documentOcrUsageDaily")}
            </h3>
            {daily.length === 0 ? (
              <p className="text-sm text-muted">
                {t("admin.documentOcrUsageEmpty")}
              </p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-card-border">
                <table className="min-w-full text-left text-sm">
                  <thead className="border-b border-card-border bg-selected/30 text-xs font-semibold uppercase tracking-wide text-muted">
                    <tr>
                      <th className="px-3 py-2">
                        {t("admin.documentOcrUsageDay")}
                      </th>
                      <th className="px-3 py-2 text-right">
                        {t("admin.documentOcrUsageScans")}
                      </th>
                      <th className="hidden px-3 py-2 sm:table-cell sm:w-[40%]">
                        {" "}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...daily].reverse().map((row) => (
                      <tr
                        key={row.day}
                        className="border-b border-card-border last:border-0"
                      >
                        <td className="px-3 py-2 font-medium text-foreground">
                          {formatDay(row.day)}
                        </td>
                        <td className="px-3 py-2 text-right font-semibold tabular-nums text-foreground">
                          {row.count}
                        </td>
                        <td className="hidden px-3 py-2 sm:table-cell">
                          <div className="h-2 overflow-hidden rounded-full bg-selected/50">
                            <div
                              className="h-full rounded-full bg-primary/70"
                              style={{
                                width: `${Math.round((row.count / maxDaily) * 100)}%`,
                              }}
                            />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="space-y-2">
            <h3 className="text-sm font-semibold text-foreground">
              {t("admin.documentOcrUsageByUser")}
            </h3>
            {rows.length === 0 ? (
              <p className="text-sm text-muted">
                {t("admin.documentOcrUsageEmpty")}
              </p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-card-border">
                <table className="min-w-full text-left text-sm">
                  <thead className="border-b border-card-border bg-selected/30 text-xs font-semibold uppercase tracking-wide text-muted">
                    <tr>
                      <th className="px-3 py-2">
                        {t("admin.documentOcrUsageUser")}
                      </th>
                      <th className="px-3 py-2">
                        {t("admin.documentOcrUsageClient")}
                      </th>
                      <th className="px-3 py-2 text-right">
                        {t("admin.documentOcrUsageScans")}
                      </th>
                      <th className="px-3 py-2">
                        {t("admin.documentOcrUsageLast")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr
                        key={row.userId}
                        className="border-b border-card-border last:border-0"
                      >
                        <td className="px-3 py-2 font-medium text-foreground">
                          {row.username}
                        </td>
                        <td className="px-3 py-2 text-muted">
                          {row.clientName
                            ? `${row.clientName}${
                                row.homeUser
                                  ? ` (${t("admin.householdNav")})`
                                  : ""
                              }`
                            : "—"}
                        </td>
                        <td className="px-3 py-2 text-right font-semibold tabular-nums text-foreground">
                          {row.scanCount}
                        </td>
                        <td className="px-3 py-2 text-muted">
                          {formatWhen(row.lastScanAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

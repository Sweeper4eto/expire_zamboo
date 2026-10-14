"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PrimaryButton, SecondaryButton } from "@/components/auth-forms";
import { LoadingSpinnerBlock } from "@/components/loading-spinner";
import { useT } from "@/components/i18n-provider";

type SupportStatus = "new" | "in_progress" | "done";

type SupportRow = {
  id: string;
  topic: string;
  status: SupportStatus;
  contact: string | null;
  message: string;
  adminNote: string | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  username: string;
  storeName: string | null;
  clientName: string | null;
};

export function SupportRequestsPanel({
  onCounts,
}: {
  onCounts?: (counts: { new: number; in_progress: number; done: number }) => void;
}) {
  const { t, dateLocale } = useT();
  const [rows, setRows] = useState<SupportRow[]>([]);
  const [status, setStatus] = useState<SupportStatus | "all">("new");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [counts, setCounts] = useState({ new: 0, in_progress: 0, done: 0 });
  const [savingId, setSavingId] = useState("");
  const [noteDraft, setNoteDraft] = useState<Record<string, string>>({});

  const topicLabel = useCallback(
    (topic: string) => {
      if (topic === "ocr") return t("support.topicOcr");
      if (topic === "billing") return t("support.topicBilling");
      if (topic === "other") return t("support.topicOther");
      return t("support.topicBug");
    },
    [t],
  );

  const statusLabel = useCallback(
    (value: SupportStatus) => {
      if (value === "in_progress") return t("support.statusInProgress");
      if (value === "done") return t("support.statusDone");
      return t("support.statusNew");
    },
    [t],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const query = status === "all" ? "" : `?status=${encodeURIComponent(status)}`;
      const response = await fetch(`/api/admin/support/requests${query}`);
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setError(data?.error ?? t("errors.saveFailed"));
        return;
      }
      const loadedCounts = data?.counts ?? { new: 0, in_progress: 0, done: 0 };
      setCounts(loadedCounts);
      onCounts?.(loadedCounts);
      setRows((data?.requests ?? []) as SupportRow[]);
      setNoteDraft((current) => {
        const next = { ...current };
        for (const row of (data?.requests ?? []) as SupportRow[]) {
          if (!(row.id in next)) next[row.id] = row.adminNote ?? "";
        }
        return next;
      });
    } catch {
      setError(t("errors.networkError"));
    } finally {
      setLoading(false);
    }
  }, [onCounts, status, t]);

  useEffect(() => {
    void load();
  }, [load]);

  async function patchRow(id: string, patch: { status?: SupportStatus; adminNote?: string }) {
    setSavingId(id);
    setError("");
    try {
      const response = await fetch("/api/admin/support/requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...patch }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setError(data?.error ?? t("errors.saveFailed"));
        return;
      }
      await load();
    } finally {
      setSavingId("");
    }
  }

  const summary = useMemo(
    () =>
      `${t("support.statusNew")}: ${counts.new} · ${t("support.statusInProgress")}: ${counts.in_progress} · ${t("support.statusDone")}: ${counts.done}`,
    [counts.done, counts.in_progress, counts.new, t],
  );

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-foreground">{t("support.inboxTitle")}</h2>
        <p className="mt-1 text-sm text-muted">{summary}</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <SecondaryButton
          onClick={() => setStatus("new")}
          disabled={status === "new"}
        >
          {t("support.statusNew")}
        </SecondaryButton>
        <SecondaryButton
          onClick={() => setStatus("in_progress")}
          disabled={status === "in_progress"}
        >
          {t("support.statusInProgress")}
        </SecondaryButton>
        <SecondaryButton
          onClick={() => setStatus("done")}
          disabled={status === "done"}
        >
          {t("support.statusDone")}
        </SecondaryButton>
        <SecondaryButton
          onClick={() => setStatus("all")}
          disabled={status === "all"}
        >
          {t("admin.auditFilters.all")}
        </SecondaryButton>
      </div>

      {loading ? (
        <LoadingSpinnerBlock wrapperClassName="flex justify-center py-4" />
      ) : null}
      {error ? <p className="text-sm text-error">{error}</p> : null}

      {!loading && rows.length === 0 ? (
        <p className="text-sm text-muted">{t("support.emptyInbox")}</p>
      ) : null}

      <div className="space-y-3">
        {rows.map((row) => (
          <article
            key={row.id}
            className="rounded-xl border border-card-border bg-background px-3 py-3"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">
                  {topicLabel(row.topic)} · {statusLabel(row.status)}
                </p>
                <p className="text-xs text-muted">
                  {row.username}
                  {row.storeName ? ` · ${row.storeName}` : ""}
                  {row.clientName ? ` · ${row.clientName}` : ""}
                </p>
                <p className="text-xs text-muted">
                  {new Date(row.createdAt).toLocaleString(dateLocale)}
                </p>
              </div>
              <code className="text-xs text-muted">{row.id.slice(0, 10)}</code>
            </div>

            {row.contact ? (
              <p className="mt-2 text-xs text-muted">
                {t("support.contact")}: {row.contact}
              </p>
            ) : null}

            <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">{row.message}</p>

            <label className="mt-3 block text-xs font-medium text-muted">
              {t("support.adminNote")}
              <textarea
                className="mt-1 min-h-20 w-full rounded-xl border border-input-border bg-input px-3 py-2 text-sm text-foreground"
                value={noteDraft[row.id] ?? ""}
                onChange={(event) =>
                  setNoteDraft((current) => ({ ...current, [row.id]: event.target.value }))
                }
              />
            </label>

            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-4">
              <PrimaryButton
                onClick={() =>
                  void patchRow(row.id, {
                    adminNote: noteDraft[row.id] ?? "",
                  })
                }
                disabled={savingId === row.id}
              >
                {t("common.save")}
              </PrimaryButton>
              <SecondaryButton
                onClick={() => void patchRow(row.id, { status: "new" })}
                disabled={savingId === row.id || row.status === "new"}
              >
                {t("support.statusNew")}
              </SecondaryButton>
              <SecondaryButton
                onClick={() => void patchRow(row.id, { status: "in_progress" })}
                disabled={savingId === row.id || row.status === "in_progress"}
              >
                {t("support.statusInProgress")}
              </SecondaryButton>
              <SecondaryButton
                onClick={() => void patchRow(row.id, { status: "done" })}
                disabled={savingId === row.id || row.status === "done"}
              >
                {t("support.statusDone")}
              </SecondaryButton>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

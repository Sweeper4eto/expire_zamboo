"use client";

import { useCallback, useEffect, useState } from "react";
import { SecondaryButton } from "@/components/auth-forms";
import { LoadingSpinnerBlock } from "@/components/loading-spinner";
import { useT } from "@/components/i18n-provider";

type WhatsNewAdminItem = {
  id: string;
  sourceKey: string | null;
  titleEn: string;
  titleBg: string;
  href: string | null;
  active: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export function WhatsNewPanel() {
  const { t } = useT();
  const [items, setItems] = useState<WhatsNewAdminItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/whats-new");
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setError(data?.error ?? t("errors.saveFailed"));
        setItems([]);
        return;
      }
      setItems(data.items ?? []);
      const created = Number(data?.sync?.created ?? 0);
      if (created > 0) {
        setMessage(t("admin.whatsNewSynced", { count: created }));
      }
    } catch {
      setError(t("errors.saveFailed"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const selectedIds = items.filter((item) => selected[item.id]).map((item) => item.id);
  const allSelected = items.length > 0 && selectedIds.length === items.length;

  function toggleAll(checked: boolean) {
    if (!checked) {
      setSelected({});
      return;
    }
    const next: Record<string, boolean> = {};
    for (const item of items) next[item.id] = true;
    setSelected(next);
  }

  async function runAction(action: "push" | "dismiss" | "delete") {
    if (selectedIds.length === 0) {
      setError(t("admin.whatsNewSelectFirst"));
      return;
    }
    if (action === "delete" && !window.confirm(t("admin.whatsNewConfirmDelete"))) {
      return;
    }
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/admin/whats-new", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedIds, action }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setError(data?.error ?? t("errors.saveFailed"));
        return;
      }
      setSelected({});
      if (action === "push") setMessage(t("admin.whatsNewPushed"));
      else if (action === "dismiss") setMessage(t("admin.whatsNewDismissed"));
      else setMessage(t("admin.whatsNewDeleted"));
      await load();
    } catch {
      setError(t("errors.saveFailed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-lg font-semibold text-foreground">
          {t("admin.whatsNewTitle")}
        </h2>
        <p className="mt-1 text-sm text-muted">{t("admin.whatsNewHint")}</p>
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-foreground">
            {t("admin.whatsNewList")}
          </h3>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy || selectedIds.length === 0}
              onClick={() => void runAction("push")}
              className="rounded-xl border border-primary bg-transparent px-3 py-2 text-sm font-semibold text-primary disabled:opacity-50"
            >
              {t("admin.whatsNewPush")}
            </button>
            <button
              type="button"
              disabled={busy || selectedIds.length === 0}
              onClick={() => void runAction("dismiss")}
              className="rounded-xl border border-card-border bg-transparent px-3 py-2 text-sm font-semibold text-foreground disabled:opacity-50"
            >
              {t("admin.whatsNewUnpublish")}
            </button>
            <button
              type="button"
              disabled={busy || selectedIds.length === 0}
              onClick={() => void runAction("delete")}
              className="rounded-xl border border-danger bg-transparent px-3 py-2 text-sm font-semibold text-danger disabled:opacity-50"
            >
              {t("common.delete")}
            </button>
          </div>
        </div>

        {error ? (
          <p className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
            {error}
          </p>
        ) : null}
        {message ? (
          <p className="rounded-xl border border-primary/30 bg-selected px-3 py-2 text-sm text-foreground">
            {message}
          </p>
        ) : null}

        {loading ? (
          <LoadingSpinnerBlock wrapperClassName="flex justify-center py-6" />
        ) : items.length === 0 ? (
          <p className="text-sm text-muted">{t("admin.whatsNewEmpty")}</p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-card-border">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-card-border text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-3 py-2.5">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={(event) => toggleAll(event.target.checked)}
                      aria-label={t("admin.whatsNewSelectAll")}
                    />
                  </th>
                  <th className="px-3 py-2.5">{t("admin.whatsNewStatus")}</th>
                  <th className="px-3 py-2.5">{t("admin.whatsNewTitleEn")}</th>
                  <th className="px-3 py-2.5">{t("admin.whatsNewTitleBg")}</th>
                  <th className="px-3 py-2.5">{t("admin.whatsNewHref")}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-b border-card-border/70 last:border-0">
                    <td className="px-3 py-3 align-top">
                      <input
                        type="checkbox"
                        checked={Boolean(selected[item.id])}
                        onChange={(event) =>
                          setSelected((prev) => ({
                            ...prev,
                            [item.id]: event.target.checked,
                          }))
                        }
                        aria-label={item.titleEn}
                      />
                    </td>
                    <td className="px-3 py-3 align-top whitespace-nowrap">
                      {item.active ? (
                        <span className="inline-flex rounded-full border border-primary/45 bg-primary/10 px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wide text-primary">
                          {t("admin.whatsNewLive")}
                        </span>
                      ) : (
                        <span className="inline-flex rounded-full border border-card-border px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wide text-muted">
                          {t("admin.whatsNewDraft")}
                        </span>
                      )}
                      {item.sourceKey ? (
                        <span className="ml-1 inline-flex rounded-full border border-card-border px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wide text-muted">
                          {t("admin.whatsNewAuto")}
                        </span>
                      ) : null}
                    </td>
                    <td className="max-w-[14rem] px-3 py-3 align-top text-foreground">
                      {item.titleEn}
                    </td>
                    <td className="max-w-[14rem] px-3 py-3 align-top text-foreground">
                      {item.titleBg}
                    </td>
                    <td className="px-3 py-3 align-top text-muted">
                      {item.href ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="text-xs text-muted">{t("admin.whatsNewPushHint")}</p>
        <SecondaryButton onClick={() => void load()} disabled={busy || loading}>
          {t("admin.refresh")}
        </SecondaryButton>
      </section>
    </div>
  );
}
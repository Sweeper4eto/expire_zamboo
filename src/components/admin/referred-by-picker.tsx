"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { adminInputClass } from "@/components/admin/admin-ui";
import { useT } from "@/components/i18n-provider";

type BusinessOption = { id: string; name: string };

/**
 * Searchable “referred by” picker — custom list (no native &lt;select&gt;,
 * which renders a white OS popup on dark admin).
 */
export function ReferredByPicker({
  clientId,
  value,
  onChange,
  disabled,
}: {
  clientId: string;
  value: string | null;
  onChange: (next: string | null) => void;
  disabled?: boolean;
}) {
  const { t } = useT();
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [options, setOptions] = useState<BusinessOption[]>([]);
  const [filter, setFilter] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const response = await fetch("/api/admin/clients?businessOnly=1");
      const data = await response.json().catch(() => null);
      if (cancelled) return;
      const list = ((data?.clients ?? []) as BusinessOption[]).filter(
        (row) => row.id !== clientId,
      );
      setOptions(list);
    })();
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent | TouchEvent) {
      const target = event.target as Node | null;
      if (!rootRef.current || !target) return;
      if (!rootRef.current.contains(target)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const filtered = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    if (!needle) return options;
    return options.filter((row) => row.name.toLowerCase().includes(needle));
  }, [filter, options]);

  const selectedLabel =
    value == null
      ? t("admin.referredByNone")
      : (options.find((row) => row.id === value)?.name ?? t("admin.referredByNone"));

  function pick(next: string | null) {
    onChange(next);
    setOpen(false);
    setFilter("");
  }

  return (
    <div className="space-y-1.5" ref={rootRef}>
      <p className="text-sm font-medium text-foreground">{t("admin.referredBy")}</p>
      <div className="relative">
        <button
          type="button"
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listId}
          className={`${adminInputClass} flex items-center justify-between gap-2 text-left disabled:opacity-50`}
          onClick={() => {
            if (disabled) return;
            setOpen((current) => !current);
          }}
        >
          <span className="min-w-0 flex-1 truncate text-foreground">
            {selectedLabel}
          </span>
          <span className="shrink-0 text-[0.65rem] text-muted" aria-hidden>
            ▼
          </span>
        </button>

        {open ? (
          <div
            className="absolute left-0 right-0 z-[120] mt-1 overflow-hidden rounded-xl border border-card-border shadow-lg shadow-black/50"
            style={{ backgroundColor: "var(--background)" }}
          >
            <input
              className={`${adminInputClass} rounded-none border-0 border-b border-card-border`}
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              placeholder={t("admin.referredBySearch")}
              autoFocus
            />
            <ul
              id={listId}
              role="listbox"
              aria-label={t("admin.referredBy")}
              className="max-h-56 overflow-y-auto py-1"
              style={{ backgroundColor: "var(--background)" }}
            >
              <li role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={value == null}
                  className={`flex w-full px-3 py-2.5 text-left text-sm ${
                    value == null
                      ? "bg-selected text-primary"
                      : "text-foreground hover:bg-selected/40"
                  }`}
                  onClick={() => pick(null)}
                >
                  {t("admin.referredByNone")}
                </button>
              </li>
              {filtered.map((row) => {
                const active = value === row.id;
                return (
                  <li key={row.id} role="presentation">
                    <button
                      type="button"
                      role="option"
                      aria-selected={active}
                      className={`flex w-full px-3 py-2.5 text-left text-sm ${
                        active
                          ? "bg-selected text-primary"
                          : "text-foreground hover:bg-selected/40"
                      }`}
                      onClick={() => pick(row.id)}
                    >
                      {row.name}
                    </button>
                  </li>
                );
              })}
              {filtered.length === 0 ? (
                <li className="px-3 py-2.5 text-sm text-muted">
                  {t("admin.noClientsFound")}
                </li>
              ) : null}
            </ul>
          </div>
        ) : null}
      </div>
      <p className="text-xs text-muted">{t("admin.referredByHint")}</p>
    </div>
  );
}

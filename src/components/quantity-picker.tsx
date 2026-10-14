"use client";

import { useEffect, useState } from "react";
import { useT } from "@/components/i18n-provider";

type Props = {
  value: string;
  onChange: (value: string) => void;
  max?: number;
  /** When false, starts collapsed so the user can tap the value to reopen the grid. */
  startWithGridOpen?: boolean;
  /** Called when a number is chosen from the grid (not the manual field). */
  onGridSelect?: (value: string) => void;
};

export function QuantityPicker({
  value,
  onChange,
  max = 20,
  startWithGridOpen = true,
  onGridSelect,
}: Props) {
  const { t } = useT();
  const [gridOpen, setGridOpen] = useState(startWithGridOpen);

  useEffect(() => {
    const parsed = Number(value);
    if (!value || Number.isNaN(parsed) || parsed < 1) {
      setGridOpen(true);
    }
  }, [value]);

  function pick(next: number) {
    const nextValue = String(next);
    onChange(nextValue);
    setGridOpen(false);
    onGridSelect?.(nextValue);
  }

  function onManualChange(raw: string) {
    onChange(raw.replace(/[^\d]/g, ""));
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold text-foreground">{t("scan.itemsHeader")}</p>

      {!gridOpen ? (
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label={t("scan.changeQuantity")}
            className="flex h-10 min-w-12 items-center justify-center rounded-lg border border-primary bg-selected px-3 text-lg font-bold tabular-nums text-primary"
            onClick={() => setGridOpen(true)}
          >
            {value}
          </button>
          <input
            className="min-w-0 flex-1 rounded-lg border border-input-border bg-input px-3 py-2 text-base text-foreground"
            inputMode="numeric"
            value={value}
            onChange={(event) => onManualChange(event.target.value)}
          />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-5 gap-1 sm:grid-cols-10">
            {Array.from({ length: max }, (_, index) => index + 1).map((amount) => (
              <button
                key={amount}
                type="button"
                className={`min-w-0 rounded-md border px-0.5 py-1 text-xs font-medium tabular-nums ${
                  value === String(amount)
                    ? "border-primary bg-selected text-primary"
                    : "border-input-border bg-transparent text-foreground"
                }`}
                onClick={() => pick(amount)}
              >
                {amount}
              </button>
            ))}
          </div>
          <input
            className="w-full rounded-lg border border-input-border bg-input px-3 py-2 text-base text-foreground"
            inputMode="numeric"
            placeholder={t("scan.manualQuantity")}
            value={value}
            onChange={(event) => onManualChange(event.target.value)}
          />
        </>
      )}
    </div>
  );
}

/** Compact − / value / + control for inline quantity editing. */
export function QuantityStepper({
  value,
  onChange,
  min = 1,
  max = 9999,
}: {
  value: string;
  onChange: (value: string) => void;
  min?: number;
  max?: number;
}) {
  const { t } = useT();
  const parsed = Number(value);
  const current =
    Number.isInteger(parsed) && parsed >= min ? parsed : min;
  const [draft, setDraft] = useState(String(current));

  useEffect(() => {
    setDraft(String(current));
  }, [current]);

  function setQty(next: number) {
    onChange(String(Math.min(max, Math.max(min, next))));
  }

  function commitDraft() {
    const next = Number(draft);
    if (!Number.isInteger(next) || next < min) {
      setQty(min);
      setDraft(String(min));
      return;
    }
    const clamped = Math.min(max, next);
    setQty(clamped);
    setDraft(String(clamped));
  }

  const digits = String(max).length;

  return (
    <div className="inline-flex shrink-0 items-center gap-1">
      <button
        type="button"
        aria-label={t("scan.decreaseQuantity")}
        disabled={current <= min}
        onClick={() => setQty(current - 1)}
        className="flex size-8 items-center justify-center rounded-lg border border-card-border text-foreground disabled:opacity-40"
      >
        <ChevronLeftIcon className="size-4" />
      </button>
      <label className="inline-flex min-w-12 cursor-text items-baseline justify-center gap-0.5 rounded-md px-0.5 text-sm font-semibold tabular-nums text-foreground">
        <input
          type="text"
          inputMode="numeric"
          autoComplete="off"
          aria-label={t("scan.changeQuantity")}
          value={draft}
          onChange={(event) => {
            const raw = event.target.value.replace(/[^\d]/g, "");
            setDraft(raw);
            if (!raw) return;
            const next = Number(raw);
            if (Number.isInteger(next) && next >= min) {
              onChange(String(Math.min(max, next)));
            }
          }}
          onFocus={(event) => event.currentTarget.select()}
          onBlur={commitDraft}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              event.currentTarget.blur();
            }
          }}
          style={{ width: `${Math.max(draft.length, 1)}ch` }}
          className="max-w-[4.5ch] border-0 bg-transparent p-0 text-center text-sm font-semibold tabular-nums text-foreground outline-none"
          maxLength={digits}
        />
        <span className="font-medium text-muted">{t("scan.quantityUnit")}</span>
      </label>
      <button
        type="button"
        aria-label={t("scan.increaseQuantity")}
        disabled={current >= max}
        onClick={() => setQty(current + 1)}
        className="flex size-8 items-center justify-center rounded-lg border border-card-border text-foreground disabled:opacity-40"
      >
        <ChevronRightIcon className="size-4" />
      </button>
    </div>
  );
}

function ChevronLeftIcon({ className = "size-4" }: { className?: string }) {
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
      <path d="M15 6l-6 6 6 6" />
    </svg>
  );
}

function ChevronRightIcon({ className = "size-4" }: { className?: string }) {
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
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

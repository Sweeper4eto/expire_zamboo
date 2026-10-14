"use client";

import { useT } from "@/components/i18n-provider";

const QUICK_PERCENTS = [25, 50, 75] as const;
export const DEFAULT_DISCOUNT_PERCENT = 25;
export const DISCOUNT_PERCENT_MIN = 5;
export const DISCOUNT_PERCENT_MAX = 100;
export const DISCOUNT_PERCENT_STEP = 5;

type Props = {
  value: number;
  onChange: (value: number) => void;
};

export function clampDiscountPercent(value: number): number {
  const stepped =
    Math.round(value / DISCOUNT_PERCENT_STEP) * DISCOUNT_PERCENT_STEP;
  return Math.min(
    DISCOUNT_PERCENT_MAX,
    Math.max(DISCOUNT_PERCENT_MIN, stepped),
  );
}

export function DiscountPercentPicker({ value, onChange }: Props) {
  const { t } = useT();
  const current = clampDiscountPercent(value);

  function step(delta: number) {
    onChange(clampDiscountPercent(current + delta));
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted">
        {t("expiry.discountPercentLabel")}
      </p>

      <div className="flex items-center justify-center gap-2">
        <button
          type="button"
          aria-label={t("expiry.discountDecrease")}
          disabled={current <= DISCOUNT_PERCENT_MIN}
          onClick={() => step(-DISCOUNT_PERCENT_STEP)}
          className="flex size-9 items-center justify-center rounded-lg border border-card-border text-lg leading-none text-foreground disabled:opacity-40"
        >
          ‹
        </button>
        <p
          className="min-w-[4.5rem] text-center text-2xl font-bold tabular-nums text-primary"
          aria-live="polite"
        >
          −{current}%
        </p>
        <button
          type="button"
          aria-label={t("expiry.discountIncrease")}
          disabled={current >= DISCOUNT_PERCENT_MAX}
          onClick={() => step(DISCOUNT_PERCENT_STEP)}
          className="flex size-9 items-center justify-center rounded-lg border border-card-border text-lg leading-none text-foreground disabled:opacity-40"
        >
          ›
        </button>
      </div>

      <div className="grid grid-cols-3 gap-1.5">
        {QUICK_PERCENTS.map((percent) => {
          const active = current === percent;
          return (
            <button
              key={percent}
              type="button"
              onClick={() => onChange(percent)}
              className={`rounded-lg border px-2 py-1.5 text-sm font-semibold tabular-nums ${
                active
                  ? "border-primary bg-selected text-primary"
                  : "border-input-border bg-transparent text-foreground"
              }`}
            >
              −{percent}%
            </button>
          );
        })}
      </div>
    </div>
  );
}

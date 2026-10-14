"use client";

import { useT } from "@/components/i18n-provider";
import {
  EXPIRY_PERIOD_OPTIONS,
  type ExpiryPeriod,
} from "@/lib/expiry-period";

type Props = {
  value: ExpiryPeriod;
  onChange: (period: ExpiryPeriod) => void;
};

function periodLabel(period: ExpiryPeriod, t: ReturnType<typeof useT>["t"]) {
  switch (period) {
    case "7d":
      return t("expiry.period7Days");
    case "14d":
      return t("expiry.period14Days");
    case "30d":
      return t("expiry.period30Days");
    case "all":
      return t("expiry.periodAll");
  }
}

export function ExpiryPeriodFilter({ value, onChange }: Props) {
  const { t } = useT();

  return (
    <div className="mb-2">
      <p className="mb-0.5 text-[10px] font-medium leading-none text-muted">
        {t("expiry.periodLabel")}
      </p>
      <div className="grid grid-cols-4 gap-0.5">
        {EXPIRY_PERIOD_OPTIONS.map((period) => {
          const active = period === value;
          return (
            <button
              key={period}
              type="button"
              onClick={() => onChange(period)}
              className={`flex min-h-7 min-w-0 items-center justify-center rounded-md border px-1 py-1 text-center text-[10px] font-medium leading-tight transition-colors ${
                active
                  ? "border-primary bg-selected text-primary"
                  : "border-input-border bg-transparent text-foreground"
              }`}
            >
              {periodLabel(period, t)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

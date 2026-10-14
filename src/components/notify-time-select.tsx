"use client";

import { MenuSelect } from "@/components/menu-select";
import { useT } from "@/components/i18n-provider";
import {
  formatMinutesAsTime,
  parseTimeToMinutes,
  snapTimeToStep,
} from "@/lib/expiry-notification-prefs";

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, hour) => {
  const value = String(hour).padStart(2, "0");
  return { value, label: value };
});

const MINUTE_OPTIONS = [
  { value: "00", label: "00" },
  { value: "15", label: "15" },
  { value: "30", label: "30" },
  { value: "45", label: "45" },
];

const selectButtonClass =
  "mt-0.5 flex w-full min-w-0 items-center justify-between gap-1.5 rounded-lg border border-input-border bg-transparent px-2 py-1.5 text-left text-sm text-foreground";

/** Compact hour + 15-min picker (same layout language as expiry month/year). */
export function NotifyTimeSelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const { t } = useT();
  const snapped = snapTimeToStep(value);
  const total = parseTimeToMinutes(snapped);
  const hour = String(Math.floor(total / 60)).padStart(2, "0");
  const minute = String(total % 60).padStart(2, "0");

  function emit(nextHour: string, nextMinute: string) {
    onChange(
      snapTimeToStep(
        formatMinutesAsTime(Number(nextHour) * 60 + Number(nextMinute)),
      ),
    );
  }

  return (
    <div className="min-w-0">
      <p className="text-xs text-muted">{label}</p>
      <div className="mt-0.5 rounded-xl border border-input-border bg-transparent p-2">
        <div className="grid grid-cols-2 gap-2">
          <label className="block min-w-0 text-xs text-muted">
            {t("pushSettings.hourLabel")}
            <MenuSelect
              label={`${label} — ${t("pushSettings.hourLabel")}`}
              value={hour}
              options={HOUR_OPTIONS}
              onChange={(next) => emit(next, minute)}
              buttonClassName={selectButtonClass}
              menuAlign="start"
            />
          </label>
          <label className="block min-w-0 text-xs text-muted">
            {t("pushSettings.minuteLabel")}
            <MenuSelect
              label={`${label} — ${t("pushSettings.minuteLabel")}`}
              value={minute}
              options={MINUTE_OPTIONS}
              onChange={(next) => emit(hour, next)}
              buttonClassName={selectButtonClass}
              menuAlign="end"
            />
          </label>
        </div>
      </div>
    </div>
  );
}

"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { useT } from "@/components/i18n-provider";
import { MenuSelect } from "@/components/menu-select";
import {
  acceptDmyDigits,
  dmyDigitsToYmd,
  dmyMaskCaretPos,
  formatDmyMask,
  parseYmdLocal,
  toYmdLocal,
  ymdToDmyDigits,
} from "@/lib/expiry-date-input";
import { expiryDateBounds } from "@/lib/expiry-date-bounds";

export {
  EXPIRY_PICKER_YEARS_AHEAD,
  EXPIRY_PICKER_YEARS_PAST,
  expiryDateBounds,
} from "@/lib/expiry-date-bounds";
export { parseFlexibleExpiryInput } from "@/lib/expiry-date-input";

function startWeekdayMonday(year: number, month: number): number {
  return (new Date(year, month, 1).getDay() + 6) % 7;
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

export type ExpiryDatePickerHandle = {
  /** Apply any in-progress typed date; returns the effective YYYY-MM-DD (or null). */
  flush: () => string | null;
};

type Props = {
  value: string;
  onChange: (value: string) => void;
  /** When true, dates up to 3 years in the past can be selected (edit/OCR correction). */
  allowPast?: boolean;
  /** When false, hides the “type date to correct OCR” hint above the manual field. */
  showTypeHint?: boolean;
  /** Tighter spacing for constrained screens (e.g. scan details). */
  compact?: boolean;
};

export const ExpiryDatePicker = forwardRef<ExpiryDatePickerHandle, Props>(
  function ExpiryDatePicker(
    {
      value,
      onChange,
      allowPast = false,
      showTypeHint = true,
      compact = false,
    },
    ref,
  ) {
    const { t, monthName } = useT();
    const { min, max } = expiryDateBounds(allowPast);
    const minDate = useMemo(() => parseYmdLocal(min)!, [min]);
    const maxDate = useMemo(() => parseYmdLocal(max)!, [max]);

    const selected = value ? parseYmdLocal(value) : null;
    const initial = selected ?? (allowPast ? new Date() : minDate);

    const [viewYear, setViewYear] = useState(initial.getFullYear());
    const [viewMonth, setViewMonth] = useState(initial.getMonth());
    const [digits, setDigits] = useState(() =>
      value ? ymdToDmyDigits(value) : "",
    );
    const [typedError, setTypedError] = useState(false);
    const maskInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
      if (!value) return;
      const parsed = parseYmdLocal(value);
      if (!parsed) return;
      setViewYear(parsed.getFullYear());
      setViewMonth(parsed.getMonth());
      setDigits(ymdToDmyDigits(value));
      setTypedError(false);
    }, [value]);

    const minYear = minDate.getFullYear();
    const maxYear = maxDate.getFullYear();
    const years = Array.from(
      { length: maxYear - minYear + 1 },
      (_, index) => minYear + index,
    );

    const monthOptions = Array.from({ length: 12 }, (_, month) => month);
    const leadingBlanks = startWeekdayMonday(viewYear, viewMonth);
    const totalDays = daysInMonth(viewYear, viewMonth);
    const dayCells: Array<number | null> = [
      ...Array.from({ length: leadingBlanks }, () => null),
      ...Array.from({ length: totalDays }, (_, index) => index + 1),
    ];

    function clampToBounds(ymd: string): string | null {
      const date = parseYmdLocal(ymd);
      if (!date) return null;
      if (date < minDate || date > maxDate) return null;
      return ymd;
    }

    function clampDate(date: Date): Date {
      if (date < minDate) return new Date(minDate);
      if (date > maxDate) return new Date(maxDate);
      return date;
    }

    function monthIsSelectable(year: number, month: number): boolean {
      const first = new Date(year, month, 1);
      const last = new Date(year, month, daysInMonth(year, month));
      return last >= minDate && first <= maxDate;
    }

    function isDayDisabled(year: number, month: number, day: number): boolean {
      const date = new Date(year, month, day);
      return date < minDate || date > maxDate;
    }

    /** Commit year/month/day immediately (used by calendar + month/year selects). */
    function commitYmd(year: number, month: number, day: number) {
      const dim = daysInMonth(year, month);
      const safeDay = Math.min(Math.max(1, day), dim);
      const next = clampDate(new Date(year, month, safeDay));
      const ymd = toYmdLocal(next);
      onChange(ymd);
      return ymd;
    }

    function selectDay(day: number) {
      if (isDayDisabled(viewYear, viewMonth, day)) return;
      commitYmd(viewYear, viewMonth, day);
    }

    function onMonthChange(nextMonth: number) {
      setViewMonth(nextMonth);
      const dayHint = selected?.getDate() ?? 1;
      commitYmd(viewYear, nextMonth, dayHint);
    }

    function onYearChange(nextYear: number) {
      let month = viewMonth;
      if (nextYear === minYear && month < minDate.getMonth()) {
        month = minDate.getMonth();
      }
      if (nextYear === maxYear && month > maxDate.getMonth()) {
        month = maxDate.getMonth();
      }
      setViewYear(nextYear);
      setViewMonth(month);
      const dayHint = selected?.getDate() ?? 1;
      commitYmd(nextYear, month, dayHint);
    }

    function commitDigits(nextDigits: string) {
      setDigits(nextDigits);
      setTypedError(false);
      if (nextDigits.length === 8) {
        const ymd = dmyDigitsToYmd(nextDigits);
        const bounded = ymd ? clampToBounds(ymd) : null;
        if (!bounded) {
          setTypedError(true);
          return;
        }
        onChange(bounded);
      }
    }

    function applyDigitsFromRaw(raw: string) {
      const accepted = acceptDmyDigits(raw, min, max);
      commitDigits(accepted);
      requestAnimationFrame(() => {
        const input = maskInputRef.current;
        if (!input) return;
        const pos = dmyMaskCaretPos(accepted.length);
        input.setSelectionRange(pos, pos);
      });
    }

    function clearDate() {
      setDigits("");
      setTypedError(false);
      onChange("");
    }

    useImperativeHandle(ref, () => ({
      flush: () => {
        if (digits.length === 0) {
          return value && parseYmdLocal(value) ? value : null;
        }
        if (digits.length !== 8) {
          setTypedError(true);
          return null;
        }
        const ymd = dmyDigitsToYmd(digits);
        const bounded = ymd ? clampToBounds(ymd) : null;
        if (!bounded) {
          setTypedError(true);
          return null;
        }
        setTypedError(false);
        onChange(bounded);
        return bounded;
      },
    }));

    const weekdayLabels = t("expiry.weekdays").split(",");
    const masked = formatDmyMask(digits);
    const maskChars = masked.split("");

    const dateField = (
      <div>
        {showTypeHint ? (
          <p className="mb-1 text-xs text-muted">{t("expiry.dateTypeHint")}</p>
        ) : null}
        <div className="flex items-center gap-2">
          <CalendarIcon className="size-5 shrink-0 text-primary" />
          <div className="relative min-w-0 flex-1 font-mono text-base tabular-nums">
            <div
              className="pointer-events-none absolute inset-0 flex items-center"
              aria-hidden
            >
              {maskChars.map((ch, index) => {
                const isPlaceholder =
                  ch === "D" || ch === "M" || ch === "Y";
                return (
                  <span
                    key={`${ch}-${index}`}
                    className={
                      isPlaceholder
                        ? "text-muted"
                        : typedError
                          ? "text-error"
                          : "text-foreground"
                    }
                  >
                    {ch}
                  </span>
                );
              })}
            </div>
            <input
              ref={maskInputRef}
              type="text"
              inputMode="numeric"
              autoComplete="off"
              spellCheck={false}
              aria-label={t("expiry.selectedDate")}
              className="relative w-full border-0 bg-transparent px-0 py-1 text-transparent caret-foreground outline-none"
              value={masked}
              onChange={(event) => applyDigitsFromRaw(event.target.value)}
              onFocus={(event) => {
                const pos = dmyMaskCaretPos(digits.length);
                event.currentTarget.setSelectionRange(pos, pos);
              }}
              onClick={(event) => {
                const pos = dmyMaskCaretPos(digits.length);
                event.currentTarget.setSelectionRange(pos, pos);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  if (digits.length === 8) {
                    const ymd = dmyDigitsToYmd(digits);
                    const bounded = ymd ? clampToBounds(ymd) : null;
                    if (!bounded) setTypedError(true);
                  } else if (digits.length > 0) {
                    setTypedError(true);
                  }
                }
                if (event.key === "Backspace") {
                  event.preventDefault();
                  commitDigits(digits.slice(0, -1));
                  requestAnimationFrame(() => {
                    const input = maskInputRef.current;
                    if (!input) return;
                    const pos = dmyMaskCaretPos(Math.max(0, digits.length - 1));
                    input.setSelectionRange(pos, pos);
                  });
                }
              }}
            />
          </div>
          <button
            type="button"
            className="shrink-0 px-0.5 text-sm font-medium text-primary disabled:opacity-40"
            disabled={!digits && !value}
            onClick={clearDate}
          >
            {t("expiry.dateClear")}
          </button>
        </div>
        {typedError ? (
          <span className="mt-1 block text-[11px] text-error">
            {t("expiry.dateTypeInvalid")}
          </span>
        ) : null}
      </div>
    );

    const selectButtonClass = compact
      ? "mt-0.5 flex w-full min-w-0 items-center justify-between gap-1.5 rounded-lg border border-input-border bg-transparent px-2 py-1 text-left text-sm text-foreground"
      : "mt-0.5 flex w-full min-w-0 items-center justify-between gap-2 rounded-lg border border-input-border bg-transparent px-2 py-1.5 text-left text-sm text-foreground";

    return (
      <div className={compact ? "space-y-1" : "space-y-2"}>
        <p
          className={
            compact
              ? "text-xs font-medium text-foreground"
              : "text-sm font-medium text-foreground"
          }
        >
          {t("expiry.dateLabel")}
        </p>

        <div className="rounded-xl border border-input-border bg-transparent p-2">
          <div
            className={`grid grid-cols-2 ${compact ? "mb-1 gap-1.5" : "mb-2 gap-2"}`}
          >
            <label className="block text-xs text-muted">
              {t("expiry.monthLabel")}
              <MenuSelect
                label={t("expiry.monthLabel")}
                value={String(viewMonth)}
                options={monthOptions.map((month) => ({
                  value: String(month),
                  label: `${monthName(month + 1)} / ${String(month + 1).padStart(2, "0")}`,
                  disabled: !monthIsSelectable(viewYear, month),
                }))}
                onChange={(next) => onMonthChange(Number(next))}
                buttonClassName={selectButtonClass}
              />
            </label>
            <label className="block text-xs text-muted">
              {t("expiry.yearLabel")}
              <MenuSelect
                label={t("expiry.yearLabel")}
                value={String(viewYear)}
                options={years.map((year) => ({
                  value: String(year),
                  label: String(year),
                }))}
                onChange={(next) => onYearChange(Number(next))}
                buttonClassName={selectButtonClass}
              />
            </label>
          </div>

          <div className="mb-1 grid grid-cols-7 gap-0.5 text-center text-[10px] font-medium text-muted">
            {weekdayLabels.map((label) => (
              <span key={label}>{label}</span>
            ))}
          </div>

          <div
            className={`grid grid-cols-7 ${compact ? "gap-x-0.5 gap-y-0.5" : "gap-0.5"}`}
          >
            {dayCells.map((day, index) =>
              day === null ? (
                <span key={`blank-${index}`} aria-hidden />
              ) : (
                <button
                  key={`${viewYear}-${viewMonth}-${day}`}
                  type="button"
                  disabled={isDayDisabled(viewYear, viewMonth, day)}
                  className={`rounded-md text-xs font-medium tabular-nums disabled:opacity-30 ${
                    compact ? "py-0.5" : "py-1"
                  } ${
                    selected &&
                    selected.getFullYear() === viewYear &&
                    selected.getMonth() === viewMonth &&
                    selected.getDate() === day
                      ? "bg-primary text-primary-fg"
                      : "text-foreground hover:bg-transparent"
                  }`}
                  onClick={() => selectDay(day)}
                >
                  {day}
                </button>
              ),
            )}
          </div>
        </div>

        {dateField}
      </div>
    );
  },
);

function CalendarIcon({ className = "size-5" }: { className?: string }) {
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
    </svg>
  );
}

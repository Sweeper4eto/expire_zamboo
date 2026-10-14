"use client";

import type { ReactNode } from "react";
import { useT } from "@/components/i18n-provider";

type Props = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  "aria-label"?: string;
  className?: string;
  inputClassName?: string;
  /** Extra work after clearing (e.g. close scanner). */
  onClear?: () => void;
  /** Rendered as a pinned button inside the field, at the trailing (end) edge. */
  trailingAction?: ReactNode;
  id?: string;
  name?: string;
  autoComplete?: string;
  disabled?: boolean;
};

export function SearchField({
  value,
  onChange,
  placeholder,
  "aria-label": ariaLabel,
  className = "",
  inputClassName = "",
  onClear,
  trailingAction,
  ...inputProps
}: Props) {
  const { t } = useT();
  const hasValue = Boolean(value);
  const showClear = hasValue;

  function clear() {
    onChange("");
    onClear?.();
  }

  // Keep typed text clear of the in-field clear / trailing controls.
  const endPad = trailingAction
    ? showClear
      ? "pr-20"
      : "pr-14"
    : showClear
      ? "pr-9"
      : "";

  return (
    <div className={`relative min-w-0 flex-1 ${className}`}>
      <input
        type="text"
        className={`w-full ${endPad} ${inputClassName}`.trim()}
        value={value}
        placeholder={placeholder}
        aria-label={ariaLabel ?? placeholder}
        onChange={(event) => onChange(event.target.value)}
        {...inputProps}
      />
      {showClear || trailingAction ? (
        <div className="absolute inset-y-0 right-1.5 z-10 flex items-center gap-1">
          {showClear ? (
            <button
              type="button"
              aria-label={t("common.clearSearch")}
              title={t("common.clearSearch")}
              className="flex size-6 shrink-0 items-center justify-center rounded-full border border-card-border bg-transparent text-base leading-none text-muted"
              onClick={clear}
            >
              ×
            </button>
          ) : null}
          {trailingAction}
        </div>
      ) : null}
    </div>
  );
}

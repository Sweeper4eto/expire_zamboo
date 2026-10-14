"use client";

import type { CSSProperties } from "react";
import { useT } from "@/components/i18n-provider";

const sizePx = {
  sm: "1.25rem",
  md: "1.75rem",
  lg: "2.25rem",
} as const;

type Props = {
  className?: string;
  size?: keyof typeof sizePx;
  /** Accessible label; defaults to common.loading. */
  label?: string;
  style?: CSSProperties;
};

export function LoadingSpinner({
  className = "",
  size = "md",
  label,
  style,
}: Props) {
  const { t } = useT();
  const dimension = sizePx[size];

  return (
    <span
      className={`document-processing-spinner ${className}`.trim()}
      style={{ width: dimension, height: dimension, ...style }}
      role="status"
      aria-label={label ?? t("common.loading")}
    />
  );
}

type BlockProps = Props & {
  wrapperClassName?: string;
};

/** Centered spinner for page sections and empty states. */
export function LoadingSpinnerBlock({
  wrapperClassName = "flex justify-center py-4",
  ...props
}: BlockProps) {
  return (
    <div className={wrapperClassName}>
      <LoadingSpinner {...props} />
    </div>
  );
}

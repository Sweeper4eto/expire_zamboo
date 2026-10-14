"use client";

import type { ReactNode } from "react";
import { CloseIcon } from "@/components/app-nav-icons";
import { appButtonCancel, appButtonCancelFull } from "@/lib/app-ui";

type Props = {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit";
  fullWidth?: boolean;
  className?: string;
};

export function CancelButton({
  children,
  onClick,
  disabled,
  type = "button",
  fullWidth = true,
  className = "",
}: Props) {
  const base = fullWidth ? appButtonCancelFull : appButtonCancel;

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`${base} ${className}`.trim()}
    >
      <CloseIcon className="size-3.5 shrink-0" />
      {children}
    </button>
  );
}

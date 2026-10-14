"use client";

import type { ReactNode } from "react";
import { ForwardArrowIcon } from "@/components/app-nav-icons";
import { appButtonPrimary, appButtonPrimaryFull } from "@/lib/app-ui";

type Props = {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit";
  fullWidth?: boolean;
  className?: string;
};

export function ForwardButton({
  children,
  onClick,
  disabled,
  type = "button",
  fullWidth = true,
  className = "",
}: Props) {
  const base = fullWidth ? appButtonPrimaryFull : appButtonPrimary;

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`${base} ${className}`.trim()}
    >
      <ForwardArrowIcon className="size-4 shrink-0" />
      {children}
    </button>
  );
}

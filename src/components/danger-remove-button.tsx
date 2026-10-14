"use client";

import type { ReactNode } from "react";
import { CloseIcon } from "@/components/app-nav-icons";
import { appButtonDangerFull } from "@/lib/app-ui";

type Props = {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit";
  className?: string;
};

export function DangerRemoveButton({
  children,
  onClick,
  disabled,
  type = "button",
  className = "",
}: Props) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`${appButtonDangerFull} ${className}`.trim()}
    >
      <CloseIcon className="size-3.5 shrink-0" />
      {children}
    </button>
  );
}

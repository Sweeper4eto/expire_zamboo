"use client";

import type { ReactNode } from "react";
import { CheckIcon } from "@/components/app-nav-icons";
import { LoadingSpinner } from "@/components/loading-spinner";
import { appButtonPrimary, appButtonPrimaryFull } from "@/lib/app-ui";

type Props = {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit";
  fullWidth?: boolean;
  className?: string;
  busy?: boolean;
  "data-testid"?: string;
};

export function ConfirmButton({
  children,
  onClick,
  disabled,
  type = "button",
  fullWidth = true,
  className = "",
  busy = false,
  "data-testid": dataTestId,
}: Props) {
  const base = fullWidth ? appButtonPrimaryFull : appButtonPrimary;

  return (
    <button
      type={type}
      disabled={disabled || busy}
      onClick={onClick}
      data-testid={dataTestId}
      className={`${base} ${className}`.trim()}
    >
      {busy ? (
        <LoadingSpinner size="sm" className="mx-auto" />
      ) : (
        <>
          <CheckIcon className="size-4 shrink-0" />
          {children}
        </>
      )}
    </button>
  );
}

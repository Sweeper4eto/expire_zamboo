"use client";

import { useEffect } from "react";
import { useT } from "@/components/i18n-provider";
import { HomeIcon, RefreshIcon } from "@/components/app-nav-icons";
import { navigateApp } from "@/lib/app-navigation";
import { appButtonNeutralFull, appButtonPrimaryFull } from "@/lib/app-ui";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useT();

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-full max-w-lg flex-col items-center justify-center gap-4 px-4 py-10 text-center">
      <p className="text-lg font-semibold text-foreground">{t("errors.pageLoadFailed")}</p>
      <p className="text-sm text-muted">{t("errors.pageLoadFailedHint")}</p>
      <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-center">
        <button
          type="button"
          className={appButtonPrimaryFull}
          onClick={() => reset()}
        >
          <RefreshIcon className="size-4 shrink-0" />
          {t("errors.reload")}
        </button>
        <button
          type="button"
          className={appButtonNeutralFull}
          onClick={() => navigateApp("/app")}
        >
          <HomeIcon className="size-4 shrink-0" />
          {t("errors.goHome")}
        </button>
      </div>
    </div>
  );
}

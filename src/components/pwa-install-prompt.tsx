"use client";

import { useEffect, useState } from "react";
import { PrimaryButton, SecondaryButton } from "@/components/auth-forms";
import {
  CheckIcon,
  CloseIcon,
  InstallIcon,
} from "@/components/app-nav-icons";
import { appFooterButtonGrid } from "@/lib/app-ui";
import { useT } from "@/components/i18n-provider";
import {
  clearDeferredInstallPrompt,
  consumePwaInstallOffer,
  dismissPwaInstallPrompt,
  getDeferredInstallPrompt,
  isIosDevice,
  shouldOfferPwaInstall,
} from "@/lib/pwa-install";

export function PwaInstallPrompt() {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [manualHint, setManualHint] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    function maybeOffer() {
      if (!shouldOfferPwaInstall()) return;
      if (!consumePwaInstallOffer()) return;
      setOpen(true);
    }

    maybeOffer();
    window.addEventListener("expire365-offer-pwa", maybeOffer);
    return () => {
      window.removeEventListener("expire365-offer-pwa", maybeOffer);
    };
  }, []);

  function close(dismissForever: boolean) {
    if (dismissForever) dismissPwaInstallPrompt();
    setOpen(false);
    setManualHint(false);
  }

  async function onInstall() {
    const deferred = getDeferredInstallPrompt();
    if (deferred) {
      setBusy(true);
      try {
        await deferred.prompt();
        const choice = await deferred.userChoice;
        clearDeferredInstallPrompt();
        if (choice.outcome === "accepted") {
          dismissPwaInstallPrompt();
          setOpen(false);
          return;
        }
        close(true);
      } catch {
        setManualHint(true);
      } finally {
        setBusy(false);
      }
      return;
    }

    setManualHint(true);
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={t("pwa.installTitle")}
    >
      <div className="w-full max-w-md rounded-2xl border border-card-border bg-background p-4 shadow-lg">
        <h2 className="text-lg font-semibold text-foreground">
          {t("pwa.installTitle")}
        </h2>
        <p className="mt-2 text-sm text-muted">{t("pwa.installBody")}</p>
        {manualHint ? (
          <p className="mt-3 rounded-xl border border-card-border bg-transparent px-3 py-2 text-sm text-foreground">
            {isIosDevice() ? t("pwa.iosHint") : t("pwa.browserHint")}
          </p>
        ) : null}
        <div className={`mt-4 ${appFooterButtonGrid}`}>
          <SecondaryButton
            onClick={() => close(true)}
            disabled={busy}
            icon={<CloseIcon className="size-4 shrink-0" />}
          >
            {t("pwa.installNo")}
          </SecondaryButton>
          {manualHint ? (
            <PrimaryButton
              onClick={() => close(true)}
              icon={<CheckIcon className="size-4 shrink-0" />}
            >
              {t("pwa.gotIt")}
            </PrimaryButton>
          ) : (
            <PrimaryButton
              onClick={() => void onInstall()}
              disabled={busy}
              icon={<InstallIcon className="size-4 shrink-0" />}
            >
              {t("pwa.installYes")}
            </PrimaryButton>
          )}
        </div>
      </div>
    </div>
  );
}
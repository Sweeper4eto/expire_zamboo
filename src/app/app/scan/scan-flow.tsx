"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { PrimaryButton } from "@/components/auth-forms";
import { CancelButton } from "@/components/cancel-button";
import { ConfirmButton } from "@/components/confirm-button";
import { ForwardButton } from "@/components/forward-button";
import { CameraIcon, ForwardArrowIcon } from "@/components/app-nav-icons";
import { BarcodeScanner } from "@/components/barcode-scanner";
import { CameraCapture, uploadImage } from "@/components/camera-capture";
import { ExpiryDatePicker } from "@/components/expiry-date-picker";
import { MobilePageHeader, listPageShellClassName } from "@/components/mobile-page-header";
import { ProductImage } from "@/components/product-image";
import { QuantityStepper } from "@/components/quantity-picker";
import { useT } from "@/components/i18n-provider";
import { goBackOrApp, navigateApp, replaceApp } from "@/lib/app-navigation";
import { appButtonCancelFull } from "@/lib/app-ui";
import { normalizeBarcode } from "@/lib/barcode";
import { isAdhocBarcode } from "@/lib/inventory-entry-display";
import { lookupProductByBarcode } from "@/lib/scan-barcode-lookup";
import { useWizardStep } from "@/lib/wizard-history";
import { getPreviousScanStep, type ScanWizardStep } from "@/lib/wizard-steps";

type ScanStep = ScanWizardStep;

export function ScanFlow() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const storeId = searchParams.get("storeId") ?? "";
  const urlBarcode = normalizeBarcode(searchParams.get("barcode") ?? "");
  const { t } = useT();
  const [barcode, setBarcode] = useState("");
  const [product, setProduct] = useState<{
    id: string;
    name: string;
    imagePath: string | null;
    barcode: string;
  } | null>(null);
  const { step, goToStep, goBack } = useWizardStep<ScanStep>({
    initialStep: "scan",
    getPreviousStep: (current) => getPreviousScanStep(current, Boolean(product)),
  });
  const [name, setName] = useState("");
  const [entryImagePath, setEntryImagePath] = useState<string | null>(null);
  /** Snapshot before the latest “new picture” — restore with Keep old picture. */
  const [imageBeforeReplace, setImageBeforeReplace] = useState<
    string | null | undefined
  >(undefined);
  const [capturingPhoto, setCapturingPhoto] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [quantity, setQuantity] = useState("1");
  const [expiryDate, setExpiryDate] = useState("");
  const [message, setMessage] = useState("");
  const [lookingUp, setLookingUp] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const beginKnownProduct = useCallback(
    (next: {
      id: string;
      name: string;
      imagePath: string | null;
      barcode: string;
    }) => {
      setProduct(next);
      setBarcode(next.barcode);
      setName(next.name);
      setEntryImagePath(null);
      setCapturingPhoto(false);
      setQuantity("1");
      setExpiryDate("");
      setMessage("");
      goToStep("date");
    },
    [goToStep],
  );

  const beginManualEntry = useCallback(
    (optionalBarcode: string) => {
      setProduct(null);
      setBarcode(optionalBarcode);
      setName("");
      setEntryImagePath(null);
      setCapturingPhoto(false);
      setQuantity("1");
      setExpiryDate("");
      setMessage("");
      goToStep("name");
    },
    [goToStep],
  );

  const beginDirectPicture = useCallback(
    (photoDataUrl?: string) => {
      setProduct(null);
      setBarcode("");
      setName("");
      setQuantity("1");
      setExpiryDate("");
      setMessage("");
      goToStep("name");

      if (!photoDataUrl) {
        setEntryImagePath(null);
        setCapturingPhoto(true);
        return;
      }

      setCapturingPhoto(false);
      setUploadingPhoto(true);
      void (async () => {
        try {
          const path = await uploadImage(photoDataUrl);
          setEntryImagePath(path);
        } catch {
          setEntryImagePath(null);
          setCapturingPhoto(true);
          setMessage(t("errors.uploadFailed"));
        } finally {
          setUploadingPhoto(false);
        }
      })();
    },
    [goToStep, t],
  );

  const lookupBarcode = useCallback(
    async (value: string) => {
      setLookingUp(true);
      setMessage("");

      try {
        const result = await lookupProductByBarcode(value);
        switch (result.status) {
          case "unauthorized":
            navigateApp("/login");
            return;
          case "error":
            setMessage(
              result.message === "NETWORK_ERROR"
                ? t("errors.networkError")
                : t("errors.lookupFailed"),
            );
            return;
          case "missing":
            setBarcode(result.barcode);
            setProduct(null);
            goToStep("missing");
            return;
          case "found":
            beginKnownProduct(result.product);
            return;
        }
      } finally {
        setLookingUp(false);
      }
    },
    [beginKnownProduct, goToStep, t],
  );

  useEffect(() => {
    if (!urlBarcode) return;
    void lookupBarcode(urlBarcode);
  }, [lookupBarcode, urlBarcode]);

  async function submitInventory() {
    if (!expiryDate) return;
    const qty = Number(quantity);
    if (!Number.isInteger(qty) || qty < 1) return;

    const resolvedName = (product?.name || name).trim();

    setSaving(true);
    setMessage("");
    try {
      const body: Record<string, unknown> = {
        storeId,
        quantity: qty,
        expiryDate: new Date(expiryDate).toISOString(),
      };

      if (product?.id) {
        body.productId = product.id;
        body.barcode = normalizeBarcode(barcode) || product.barcode;
      } else {
        body.name = resolvedName;
        const normalized = normalizeBarcode(barcode);
        if (normalized) body.barcode = normalized;
        if (entryImagePath) body.imagePath = entryImagePath;
      }

      const response = await fetch("/api/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        setMessage(data?.error ?? t("errors.saveFailed"));
        return;
      }
      router.push(
        storeId
          ? `/app/expiry?storeId=${encodeURIComponent(storeId)}`
          : "/app",
      );
    } finally {
      setSaving(false);
    }
  }

  const displayName =
    (product?.name || name).trim() || t("common.noName");
  const displayBarcode = normalizeBarcode(barcode) || product?.barcode || "";
  const showBarcode = displayBarcode && !isAdhocBarcode(displayBarcode);
  const previewImage = entryImagePath || product?.imagePath || null;
  const headerTitle =
    step === "missing" ? t("scan.resultTitle") : t("scan.title");

  function skipMissingItem() {
    // Soft-navigating to the same /app/scan URL does nothing — stay on this
    // page and reset the wizard instead.
    setMessage("");
    setProduct(null);
    setBarcode("");
    setName("");
    setEntryImagePath(null);
    setCapturingPhoto(false);
    setQuantity("1");
    setExpiryDate("");
    goToStep("scan");
    if (urlBarcode) {
      replaceApp(
        storeId
          ? `/app/scan?storeId=${encodeURIComponent(storeId)}`
          : "/app/scan",
      );
    }
  }

  return (
    <div
      className={
        step === "date"
          ? listPageShellClassName
          : "mx-auto min-w-0 max-w-lg overflow-x-visible px-4 pb-6 pt-1"
      }
    >
      {mounted ? (
        <span data-testid="scan-flow-ready" className="sr-only" aria-hidden />
      ) : null}
      <div className="shrink-0">
        <MobilePageHeader
          title={headerTitle}
          className={step === "date" ? "mb-2" : undefined}
        />
      </div>

      {step === "scan" ? (
        <div className="rounded-2xl border border-card-border p-4">
          {lookingUp ? (
            <p className="mb-4 text-sm text-muted">{t("scan.lookingUp")}</p>
          ) : null}
          {message ? <p className="mb-4 text-sm text-error">{message}</p> : null}
          <BarcodeScanner
            autoStart={!urlBarcode}
            onScan={lookupBarcode}
            onSkipWithoutBarcode={(photo) => beginDirectPicture(photo)}
            onCancel={() =>
              goBackOrApp(
                storeId
                  ? `/app/scan?storeId=${encodeURIComponent(storeId)}`
                  : "/app",
              )
            }
          />
        </div>
      ) : null}

      {step === "missing" ? (
        <div className="flex flex-col items-center text-center">
          <p className="-mt-1 mb-6 w-full text-left text-sm text-muted">
            {t("scan.stepOf", { current: 1, total: 1 })}
          </p>

          <ScanNotFoundIllustration className="mb-5 size-28 text-primary" />

          <h2 className="text-xl font-semibold text-foreground">
            {t("scan.productNotFoundTitle")}
          </h2>
          <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted">
            {t("scan.productNotFoundBody")}
          </p>

          <div className="mt-6 w-full space-y-3 text-left">
            <ScanMissingActionCard
              icon={<PencilIcon className="size-5" />}
              title={t("scan.enterManuallyTitle")}
              hint={t("scan.enterManuallyHint")}
              actionLabel={t("scan.enterManuallyAction")}
              actionIcon={<PencilIcon className="size-3.5 shrink-0" />}
              onAction={() => beginManualEntry(barcode)}
            />
            <ScanMissingActionCard
              icon={<ForwardArrowIcon className="size-5" />}
              title={t("scan.skipTitle")}
              hint={t("scan.skipHint")}
              actionLabel={t("scan.skipAction")}
              actionIcon={<ForwardArrowIcon className="size-3.5 shrink-0" />}
              onAction={skipMissingItem}
            />
          </div>

          <div className="mt-5 flex w-full items-start gap-2.5 rounded-xl border border-card-border px-3 py-2.5 text-left">
            <InfoIcon className="mt-0.5 size-4 shrink-0 text-muted" />
            <p className="text-xs leading-relaxed text-muted">
              {t("scan.addLaterHint")}
            </p>
          </div>
        </div>
      ) : null}

      {step === "name" ? (
        <div className="space-y-4 rounded-2xl border border-card-border p-4">
          {capturingPhoto ? (
            <CameraCapture
              autoStart
              forceInAppCamera
              confirmMode="instant"
              keepOldPicture={imageBeforeReplace !== undefined}
              onCapture={(dataUrl) => {
                void (async () => {
                  setUploadingPhoto(true);
                  setMessage("");
                  try {
                    const path = await uploadImage(dataUrl);
                    setEntryImagePath(path);
                    setCapturingPhoto(false);
                  } catch {
                    setMessage(t("errors.uploadFailed"));
                  } finally {
                    setUploadingPhoto(false);
                  }
                })();
              }}
              onCancel={() => {
                setCapturingPhoto(false);
                setImageBeforeReplace(undefined);
              }}
            />
          ) : (
            <>
              <ProductImage
                src={entryImagePath}
                alt=""
                className="mx-auto h-32 w-32 rounded-xl object-cover"
                placeholderClassName="mx-auto h-32 w-32 rounded-xl"
              />
              <PrimaryButton
                onClick={() => {
                  setImageBeforeReplace(entryImagePath);
                  setCapturingPhoto(true);
                }}
                disabled={uploadingPhoto}
                icon={<CameraIcon className="size-4 shrink-0" />}
              >
                {entryImagePath
                  ? t("camera.newPhoto")
                  : t("scan.takePhotoOptional")}
              </PrimaryButton>
              {imageBeforeReplace !== undefined &&
              entryImagePath !== imageBeforeReplace ? (
                <button
                  type="button"
                  disabled={uploadingPhoto}
                  className={appButtonCancelFull}
                  onClick={() => {
                    setEntryImagePath(imageBeforeReplace);
                    setImageBeforeReplace(undefined);
                  }}
                >
                  {t("camera.keepOldPicture")}
                </button>
              ) : null}
            </>
          )}
          {uploadingPhoto ? (
            <p className="text-xs text-muted">{t("scanner.starting")}</p>
          ) : null}
          {barcode && !isAdhocBarcode(barcode) ? (
            <label className="block text-sm font-medium text-foreground">
              {t("common.barcode")}
              <input
                className="mt-1 w-full rounded-xl border border-input-border bg-input px-3 py-3 text-base text-foreground"
                value={barcode}
                onChange={(event) => setBarcode(event.target.value)}
              />
            </label>
          ) : null}
          <label className="block text-sm font-medium text-foreground">
            {t("scan.enterName")}
            <input
              className="mt-1 w-full rounded-xl border border-input-border bg-input px-3 py-3 text-base text-foreground"
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoFocus
            />
          </label>
          <p className="text-xs text-muted">{t("scan.skipPhotoHint")}</p>
          {message ? <p className="text-sm text-error">{message}</p> : null}
          <ForwardButton
            onClick={() => {
              setQuantity("1");
              setExpiryDate("");
              setImageBeforeReplace(undefined);
              goToStep("date");
            }}
            disabled={capturingPhoto || uploadingPhoto}
          >
            {t("common.next")}
          </ForwardButton>
          <CancelButton onClick={goBack}>{t("common.cancel")}</CancelButton>
        </div>
      ) : null}

      {step === "date" ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-y-contain pb-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:w-0 [&::-webkit-scrollbar]:h-0">
            <div className="flex items-center gap-3 rounded-2xl border border-card-border p-2.5">
              <ProductImage
                src={previewImage}
                alt={displayName}
                className="size-14 shrink-0 rounded-xl object-cover"
                placeholderClassName="size-14 shrink-0 rounded-xl"
              />
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-semibold text-foreground">
                    {displayName}
                  </p>
                  {showBarcode ? (
                    <p className="mt-0.5 truncate font-mono text-xs text-muted">
                      {displayBarcode}
                    </p>
                  ) : null}
                </div>
                <QuantityStepper value={quantity} onChange={setQuantity} />
              </div>
            </div>

            <ExpiryDatePicker
              value={expiryDate}
              onChange={setExpiryDate}
              showTypeHint={false}
              compact
            />
          </div>

          <div className="shrink-0 space-y-2 border-t border-card-border bg-background pt-2 pb-1">
            {message ? <p className="text-sm text-error">{message}</p> : null}
            <CancelButton onClick={goBack}>{t("common.cancel")}</CancelButton>
            <ConfirmButton
              onClick={() => void submitInventory()}
              disabled={!expiryDate || Number(quantity) < 1 || saving}
              busy={saving}
            >
              {t("scan.saveToExpiry")}
            </ConfirmButton>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ScanMissingActionCard({
  icon,
  title,
  hint,
  actionLabel,
  actionIcon,
  onAction,
}: {
  icon: ReactNode;
  title: string;
  hint: string;
  actionLabel: string;
  actionIcon: ReactNode;
  onAction: () => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-card-border px-3 py-3">
      <div className="flex size-11 shrink-0 items-center justify-center rounded-full border border-primary/50 text-primary">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="mt-0.5 text-xs leading-snug text-muted">{hint}</p>
      </div>
      <button
        type="button"
        onClick={onAction}
        className="inline-flex h-8 w-[6.25rem] shrink-0 items-center justify-center gap-1 rounded-lg border border-primary px-2 text-xs font-semibold text-primary"
      >
        {actionIcon}
        <span className="truncate">{actionLabel}</span>
      </button>
    </div>
  );
}

function ScanNotFoundIllustration({ className = "" }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 120 120"
      fill="none"
      className={className}
    >
      <circle
        cx="54"
        cy="52"
        r="36"
        stroke="currentColor"
        strokeWidth="8"
        strokeLinecap="round"
        strokeDasharray="185 55"
        strokeDashoffset="20"
      />
      <path
        d="M38 54l13 13 26-30"
        stroke="currentColor"
        strokeWidth="9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="90" cy="88" r="20" fill="var(--background)" />
      <circle
        cx="90"
        cy="88"
        r="16"
        stroke="currentColor"
        strokeWidth="3.5"
      />
      <path
        d="M84 84c0-3.5 2.7-6 6-6s6 2.5 6 6c0 2.4-1.4 3.6-3 5-.8.7-1.5 1.4-1.5 2.5"
        stroke="currentColor"
        strokeWidth="3.2"
        strokeLinecap="round"
      />
      <circle cx="90" cy="98" r="2.2" fill="currentColor" />
    </svg>
  );
}

function PencilIcon({ className = "size-5" }: { className?: string }) {
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
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

function InfoIcon({ className = "size-4" }: { className?: string }) {
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
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5" />
      <circle cx="12" cy="8" r="0.8" fill="currentColor" stroke="none" />
    </svg>
  );
}

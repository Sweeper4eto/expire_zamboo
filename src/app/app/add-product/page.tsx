"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { SecondaryButton } from "@/components/auth-forms";
import { CameraOffIcon } from "@/components/app-nav-icons";
import { CancelButton } from "@/components/cancel-button";
import { ConfirmButton } from "@/components/confirm-button";
import { ForwardButton } from "@/components/forward-button";
import { BarcodeScanner } from "@/components/barcode-scanner";
import { CameraCapture, uploadImage } from "@/components/camera-capture";
import { LoadingSpinnerBlock } from "@/components/loading-spinner";
import { MobilePageHeader } from "@/components/mobile-page-header";
import { useT } from "@/components/i18n-provider";
import { normalizeBarcode } from "@/lib/barcode";
import { replaceApp } from "@/lib/app-navigation";
import { useWizardStep } from "@/lib/wizard-history";
import {
  getPreviousAddProductStep,
  type AddProductWizardStep,
} from "@/lib/wizard-steps";

type AddProductStep = AddProductWizardStep;

function AddProductFlow() {
  const router = useRouter();
  const { t } = useT();
  const searchParams = useSearchParams();
  const storeId = searchParams.get("storeId") ?? "";
  const initialBarcode = normalizeBarcode(searchParams.get("barcode") ?? "");
  const initialStep: AddProductStep = initialBarcode ? "name" : "scan";
  const { step, goToStep, goBack } = useWizardStep<AddProductStep>({
    initialStep,
    getPreviousStep: (current) => getPreviousAddProductStep(current, initialBarcode),
  });
  const [barcode, setBarcode] = useState(initialBarcode);
  const [name, setName] = useState("");
  const [imagePath, setImagePath] = useState("");
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [lookingUpName, setLookingUpName] = useState(false);

  useEffect(() => {
    if (!initialBarcode) return;

    let cancelled = false;
    setLookingUpName(true);
    void fetch("/api/products/resolve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ barcode: initialBarcode, importExternal: false }),
    })
      .then(async (response) => {
        const data = await response.json().catch(() => null);
        if (cancelled || !data) return;
        if (data.status === "suggestion" && data.suggestion?.name) {
          setName(data.suggestion.name);
        } else if (data.status === "found" && data.product?.name) {
          setName(data.product.name);
        }
      })
      .finally(() => {
        if (!cancelled) setLookingUpName(false);
      });

    return () => {
      cancelled = true;
    };
  }, [initialBarcode]);

  const checkBarcode = useCallback(async (value: string) => {
    const normalized = normalizeBarcode(value);
    if (!normalized) return;

    try {
      const response = await fetch(`/api/products?barcode=${encodeURIComponent(normalized)}`);
      if (!response.ok) {
        setError(t("errors.lookupFailed"));
        return;
      }
      const data = await response.json();
      if (data.product) {
        setError(t("errors.productExistsGlobal"));
        return;
      }
      setBarcode(normalized);
      setError("");
      goToStep("name");
    } catch {
      setError(t("errors.networkError"));
    }
  }, [goToStep, t]);

  async function onPhotoCapture(dataUrl: string) {
    setPhotoPreview(dataUrl);
    setImagePath("");
    setError("");
    goToStep("confirm");
    setUploading(true);

    try {
      const path = await uploadImage(dataUrl);
      setImagePath(path);
    } catch (captureError) {
      setError(
        captureError instanceof Error ? captureError.message : t("errors.uploadFailed"),
      );
    } finally {
      setUploading(false);
    }
  }

  function skipPhoto() {
    setPhotoPreview(null);
    setImagePath("");
    setError("");
    goToStep("confirm");
  }

  const confirmPhotoSrc = photoPreview || imagePath;

  async function saveProduct() {
    const normalizedBarcode = normalizeBarcode(barcode);
    if (!normalizedBarcode) return;
    try {
      const response = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          barcode: normalizedBarcode,
          name,
          imagePath: imagePath || undefined,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error ?? t("errors.saveFailed"));
        return;
      }
      replaceApp(
        `/app/scan?storeId=${encodeURIComponent(storeId)}&barcode=${encodeURIComponent(data.product.barcode)}`,
      );
    } catch {
      setError(t("errors.networkError"));
    }
  }

  return (
    <div className="mx-auto min-w-0 max-w-lg overflow-x-visible px-4 pb-6 pt-1">
      <MobilePageHeader title={t("addProduct.title")} />

      {step === "scan" ? (
        <div className="rounded-2xl border border-card-border p-4">
          <BarcodeScanner
            autoStart
            onScan={(value) => void checkBarcode(value)}
            onCancel={() => router.back()}
          />
          {error ? <p className="mt-2 text-sm text-error">{error}</p> : null}
        </div>
      ) : null}

      {step === "name" ? (
        <div className="space-y-4 rounded-2xl border border-card-border p-4">
          <label className="block text-sm font-medium text-foreground">
            {t("common.barcode")}
            <input
              className="mt-1 w-full rounded-xl border border-input-border bg-input px-3 py-3 text-base text-foreground"
              value={barcode}
              onChange={(event) => setBarcode(event.target.value)}
            />
          </label>
          {lookingUpName ? (
            <p className="text-sm text-muted">{t("addProduct.lookingUpName")}</p>
          ) : null}
          <input
            className="w-full rounded-xl border border-input-border bg-input px-3 py-3 text-base text-foreground"
            placeholder={t("addProduct.productName")}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <ForwardButton onClick={() => goToStep("photo")} disabled={!name.trim()}>
            {t("common.next")}
          </ForwardButton>
          <CancelButton
            onClick={() => {
              if (initialBarcode) {
                router.back();
                return;
              }
              goBack();
            }}
          >
            {t("common.cancel")}
          </CancelButton>
        </div>
      ) : null}

      {step === "photo" ? (
        <div className="space-y-4 rounded-2xl border border-card-border p-4">
          <p className="text-sm text-muted">{t("addProduct.takePhoto")}</p>
          {uploading ? (
            <LoadingSpinnerBlock wrapperClassName="flex justify-center py-2" size="sm" />
          ) : null}
          <CameraCapture
            autoStart
            forceInAppCamera
            confirmMode="instant"
            onCapture={(dataUrl) => void onPhotoCapture(dataUrl)}
            onCancel={goBack}
          />
          <SecondaryButton
            onClick={skipPhoto}
            icon={<CameraOffIcon className="size-4 shrink-0" />}
          >
            {t("addProduct.skipPhoto")}
          </SecondaryButton>
          {error ? <p className="text-sm text-error">{error}</p> : null}
        </div>
      ) : null}

      {step === "confirm" ? (
        <div className="space-y-4 rounded-2xl border border-card-border p-4">
          {confirmPhotoSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={confirmPhotoSrc}
              alt={name}
              className="mx-auto max-h-64 w-full rounded-xl border border-card-border object-contain"
            />
          ) : (
            <p className="text-sm text-muted">{t("addProduct.noPhoto")}</p>
          )}
          {uploading ? (
            <LoadingSpinnerBlock wrapperClassName="flex justify-center py-2" size="sm" />
          ) : null}
          <p className="text-lg font-medium">{name}</p>
          <p className="text-sm text-muted">
            {t("common.barcode")}: {barcode}
          </p>
          {error ? <p className="text-sm text-error">{error}</p> : null}
          <ConfirmButton
            onClick={() => void saveProduct()}
            disabled={!name.trim()}
            busy={uploading}
          >
            {t("scan.enter")}
          </ConfirmButton>
          <CancelButton onClick={goBack}>{t("common.cancel")}</CancelButton>
        </div>
      ) : null}
    </div>
  );
}

export default function AddProductPage() {
  return (
    <Suspense>
      <AddProductFlow />
    </Suspense>
  );
}

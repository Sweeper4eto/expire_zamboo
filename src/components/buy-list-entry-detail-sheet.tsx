"use client";

import { useEffect, useState } from "react";
import { QuantityStepper } from "@/components/quantity-picker";
import {
  CameraIcon,
  CopyIcon,
  StarFavouriteIcon,
} from "@/components/app-nav-icons";
import { CameraCapture, uploadImage } from "@/components/camera-capture";
import { ProductImage } from "@/components/product-image";
import { MobilePageHeader } from "@/components/mobile-page-header";
import { useT } from "@/components/i18n-provider";
import { useViewportInsets } from "@/hooks/use-viewport-insets";
import { CancelButton } from "@/components/cancel-button";
import { ConfirmButton } from "@/components/confirm-button";
import { appFooterButtonGrid } from "@/lib/app-ui";
import { isAdhocBarcode } from "@/lib/inventory-entry-display";

function CopyTextButton({
  text,
  label,
  copiedLabel,
}: {
  text: string;
  label: string;
  copiedLabel: string;
}) {
  const [copied, setCopied] = useState(false);

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    }
  }

  return (
    <button
      type="button"
      aria-label={copied ? copiedLabel : label}
      title={copied ? copiedLabel : label}
      className="flex size-8 shrink-0 items-center justify-center rounded-md border border-card-border text-muted hover:text-foreground"
      onClick={() => void onCopy()}
    >
      {copied ? (
        <span className="text-[9px] font-semibold text-primary">OK</span>
      ) : (
        <CopyIcon className="size-3.5" />
      )}
    </button>
  );
}

export type BuyListDetailEntry = {
  id: string;
  barcode: string;
  quantity: number;
  product: { id: string; name: string; imagePath: string | null };
};

type Props = {
  entry: BuyListDetailEntry;
  storeId: string;
  favourite?: boolean;
  /** Persist favourite only when Save is confirmed (draft star until then). */
  onCommitFavourite?: (nextFavourite: boolean) => void | Promise<void>;
  onClose: () => void;
  onUpdated: (entry: BuyListDetailEntry) => void;
};

export function BuyListEntryDetailSheet({
  entry,
  storeId,
  favourite = false,
  onCommitFavourite,
  onClose,
  onUpdated,
}: Props) {
  const { t } = useT();
  const { offsetTop, keyboardInset } = useViewportInsets();
  const [quantity, setQuantity] = useState(String(entry.quantity));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState(entry.product.name);
  const [barcodeDraft, setBarcodeDraft] = useState(
    isAdhocBarcode(entry.barcode) ? "" : entry.barcode,
  );
  const [changingPicture, setChangingPicture] = useState(false);
  const [imageDraft, setImageDraft] = useState<string | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [favouriteDraft, setFavouriteDraft] = useState(favourite);

  const savedBarcodeDisplay = isAdhocBarcode(entry.barcode) ? "" : entry.barcode;
  const parsedQuantity = Number(quantity);
  const quantityValid =
    quantity.length > 0 &&
    Number.isInteger(parsedQuantity) &&
    parsedQuantity >= 1;
  const displayImage = imageDraft ?? entry.product.imagePath;
  const displayName = nameDraft.trim() || t("common.noName");
  const favouriteChanged = favouriteDraft !== favourite;

  const entryChanged =
    Boolean(imageDraft) ||
    (quantityValid && parsedQuantity !== entry.quantity) ||
    nameDraft.trim() !== entry.product.name.trim() ||
    barcodeDraft.trim() !== savedBarcodeDisplay.trim();
  const hasChanges = entryChanged || favouriteChanged;
  const canConfirm = hasChanges && quantityValid;

  useEffect(() => {
    setQuantity(String(entry.quantity));
    setNameDraft(entry.product.name);
    setBarcodeDraft(isAdhocBarcode(entry.barcode) ? "" : entry.barcode);
    setImageDraft(null);
    setChangingPicture(false);
    setEditingName(false);
    setFavouriteDraft(favourite);
    setError(null);
  }, [
    entry.id,
    entry.quantity,
    entry.barcode,
    entry.product.name,
    entry.product.imagePath,
    favourite,
  ]);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !saving) onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose, saving]);

  async function confirmChanges() {
    if (!canConfirm) return;

    setSaving(true);
    setError(null);

    try {
      if (entryChanged) {
        const body: Record<string, unknown> = {
          entryId: entry.id,
          storeId,
        };
        if (imageDraft) {
          body.imagePath = await uploadImage(imageDraft);
        }
        if (parsedQuantity !== entry.quantity) {
          body.quantity = parsedQuantity;
        }
        if (nameDraft.trim() !== entry.product.name.trim()) {
          body.name = nameDraft.trim();
        }
        if (barcodeDraft.trim() !== savedBarcodeDisplay.trim()) {
          body.barcode = barcodeDraft.trim() || null;
        }

        const response = await fetch("/api/buy-list", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = ((await response.json().catch(() => null)) ?? {}) as {
          entry?: BuyListDetailEntry;
          error?: string;
        };

        if (!response.ok || !data.entry) {
          setError(data.error ?? t("buyList.saveFailed"));
          return;
        }

        onUpdated(data.entry);
        setImageDraft(null);
      }

      if (favouriteChanged && onCommitFavourite) {
        await onCommitFavourite(favouriteDraft);
      }

      onClose();
    } catch (err) {
      setError(
        err instanceof Error && err.message
          ? err.message
          : t("buyList.saveFailed"),
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-x-0 z-[60] flex flex-col bg-background"
      style={{ top: offsetTop, bottom: keyboardInset }}
      role="dialog"
      aria-modal="true"
      aria-label={displayName}
    >
      <div className="shrink-0 px-4 pt-1">
        <MobilePageHeader className="mb-2" />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-4 pb-3">
        <div className="overflow-hidden rounded-2xl border border-card-border p-3">
          <div className="flex items-stretch gap-3">
            <div className="flex w-[42%] shrink-0 flex-col justify-between gap-2">
              <ProductImage
                src={displayImage}
                alt={displayName}
                className="aspect-square w-full rounded-xl object-cover"
                placeholderClassName="aspect-square w-full rounded-xl text-xs"
              />
              <button
                type="button"
                className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-card-border px-1.5 text-xs font-medium text-foreground"
                onClick={() => setChangingPicture(true)}
                disabled={saving}
              >
                <CameraIcon className="size-3.5" />
                {t("buyList.changePhotoButton")}
              </button>
              {imageDraft ? (
                <button
                  type="button"
                  className="inline-flex h-8 items-center justify-center rounded-md border border-white px-1.5 text-xs font-medium text-white"
                  onClick={() => setImageDraft(null)}
                  disabled={saving}
                >
                  {t("camera.keepOldPicture")}
                </button>
              ) : null}
            </div>

            <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
              <div className="flex min-w-0 items-start gap-1.5">
                {editingName ? (
                  <textarea
                    autoFocus
                    rows={4}
                    className="max-h-[5.4rem] w-0 min-w-0 flex-1 resize-none overflow-hidden break-words bg-transparent text-base font-semibold leading-tight text-foreground outline-none"
                    value={nameDraft}
                    onChange={(event) => setNameDraft(event.target.value)}
                    onBlur={() => setEditingName(false)}
                    placeholder={t("common.noName")}
                    disabled={saving}
                    aria-label={t("common.name")}
                  />
                ) : (
                  <button
                    type="button"
                    className="line-clamp-4 min-w-0 flex-1 break-words text-left text-base font-semibold leading-tight text-foreground"
                    onClick={() => {
                      if (!saving) setEditingName(true);
                    }}
                    aria-label={t("common.name")}
                  >
                    {displayName}
                  </button>
                )}
                <CopyTextButton
                  text={nameDraft.trim() || entry.product.name}
                  label={t("buyList.copyName")}
                  copiedLabel={t("buyList.copied")}
                />
                {onCommitFavourite ? (
                  <button
                    type="button"
                    aria-label={
                      favouriteDraft
                        ? t("favourites.remove")
                        : t("favourites.add")
                    }
                    className={`mt-0.5 shrink-0 ${
                      favouriteDraft ? "text-amber-400" : "text-muted"
                    }`}
                    onClick={() => setFavouriteDraft((current) => !current)}
                    disabled={saving}
                  >
                    <StarFavouriteIcon
                      className="size-5"
                      filled={favouriteDraft}
                    />
                  </button>
                ) : null}
              </div>

              <div className="mt-auto space-y-0 pt-1.5">
                <label className="block">
                  <span className="text-[10px] font-medium leading-none text-muted">
                    {t("common.barcode")}
                  </span>
                  <div className="mt-px flex min-w-0 items-center gap-1">
                    <input
                      className="h-8 min-w-0 flex-1 rounded-md border border-card-border bg-transparent px-1.5 font-mono text-sm leading-none text-foreground outline-none focus:border-primary"
                      value={barcodeDraft}
                      onChange={(event) => setBarcodeDraft(event.target.value)}
                      disabled={saving}
                    />
                    <CopyTextButton
                      text={barcodeDraft.trim() || entry.barcode}
                      label={t("buyList.copyBarcode")}
                      copiedLabel={t("buyList.copied")}
                    />
                  </div>
                </label>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-3 rounded-2xl border border-card-border p-2.5">
          <p className="text-[10px] font-medium text-muted">
            {t("common.quantity")}
          </p>
          <div className="mt-2 flex justify-center">
            <QuantityStepper value={quantity} onChange={setQuantity} />
          </div>
        </div>

        {error ? (
          <p className="mt-2 text-sm text-danger" role="alert">
            {error}
          </p>
        ) : null}
      </div>

      <div className="shrink-0 border-t border-card-border px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))]">
        <div className={appFooterButtonGrid}>
          <CancelButton onClick={onClose} disabled={saving}>
            {t("buyList.confirmCancel")}
          </CancelButton>
          <ConfirmButton
            busy={saving}
            disabled={!canConfirm}
            onClick={() => void confirmChanges()}
          >
            {t("buyList.saveChangesButton")}
          </ConfirmButton>
        </div>
      </div>

      {changingPicture ? (
        <div className="fixed inset-0 z-[70] flex select-none flex-col overflow-y-auto bg-background px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(0.75rem,env(safe-area-inset-top))]">
          <div className="mx-auto flex w-full max-w-md flex-col gap-3">
            <p className="text-center text-sm font-medium text-foreground select-none">
              {t("camera.changePhotoTitle")}
            </p>
            <CameraCapture
              autoStart
              forceInAppCamera
              captureOnPreviewTap
              confirmMode="instant"
              keepOldPicture
              onCapture={(dataUrl) => {
                setImageDraft(dataUrl);
                setChangingPicture(false);
                setError(null);
              }}
              onCancel={() => setChangingPicture(false)}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

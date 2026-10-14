"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ExpiryDatePicker,
  type ExpiryDatePickerHandle,
} from "@/components/expiry-date-picker";
import { QuantityStepper } from "@/components/quantity-picker";
import {
  DEFAULT_DISCOUNT_PERCENT,
  DiscountPercentPicker,
} from "@/components/discount-percent-picker";
import {
  CalendarIcon,
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
import { daysUntilExpiry, formatLocaleDay, formatLocaleTime } from "@/lib/expiry";
import {
  isAdhocBarcode,
  resolveEntryImagePath,
} from "@/lib/inventory-entry-display";
import { expiryIsoToYmd, expiryYmdToIso } from "@/lib/inventory";

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

export type ExpiryDetailEntry = {
  id: string;
  barcode: string;
  articul: string | null;
  imagePath: string | null;
  quantity: number;
  expiryDate: string;
  enteredAt?: string;
  priceReducedAt: string | null;
  priceDiscountPercent?: number | null;
  priceReducedByUser?: { id: string; username: string } | null;
  addedByUser?: { id: string; username: string } | null;
  product: { id: string; name: string; imagePath: string | null };
};

type UpdateMeta = {
  merged?: boolean;
  removedId?: string;
};

type Props = {
  entry: ExpiryDetailEntry;
  storeId: string;
  homeUser?: boolean;
  favourite?: boolean;
  onToggleFavourite?: () => void;
  onClose: () => void;
  onUpdated: (entry: ExpiryDetailEntry, meta?: UpdateMeta) => void;
};

function daysRemainingLabel(
  days: number,
  t: ReturnType<typeof useT>["t"],
): string {
  if (days === 0) return t("expiry.today");
  if (days === 1) return t("expiry.dayLeft");
  if (days > 1) return t("expiry.daysLeft", { count: days });
  const overdue = Math.abs(days);
  return t("expiry.expiredAgo", { count: overdue });
}

export function ExpiryEntryDetailSheet({
  entry,
  storeId,
  homeUser = false,
  favourite = false,
  onToggleFavourite,
  onClose,
  onUpdated,
}: Props) {
  const { t, dateLocale } = useT();
  const { offsetTop, keyboardInset } = useViewportInsets();
  const datePickerRef = useRef<ExpiryDatePickerHandle>(null);
  const sheetScrollRef = useRef<HTMLDivElement>(null);
  const expirySectionRef = useRef<HTMLDivElement>(null);
  const [quantity, setQuantity] = useState(String(entry.quantity));
  const [expiryYmd, setExpiryYmd] = useState(() =>
    expiryIsoToYmd(entry.expiryDate),
  );
  const [editingExpiry, setEditingExpiry] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const savedPriceReduced = entry.priceReducedAt !== null;
  const savedDiscountPercent =
    entry.priceDiscountPercent ?? DEFAULT_DISCOUNT_PERCENT;
  const [priceReducedDraft, setPriceReducedDraft] = useState(savedPriceReduced);
  const [discountPercentDraft, setDiscountPercentDraft] =
    useState(savedDiscountPercent);
  const [articulDraft, setArticulDraft] = useState(entry.articul ?? "");
  const [nameDraft, setNameDraft] = useState(entry.product.name);
  const [barcodeDraft, setBarcodeDraft] = useState(
    isAdhocBarcode(entry.barcode) ? "" : entry.barcode,
  );
  const [changingPicture, setChangingPicture] = useState(false);
  const [imageDraft, setImageDraft] = useState<string | null>(null);
  const [editingName, setEditingName] = useState(false);

  const savedExpiryYmd = expiryIsoToYmd(entry.expiryDate);
  const savedBarcodeDisplay = isAdhocBarcode(entry.barcode) ? "" : entry.barcode;
  const parsedQuantity = Number(quantity);
  const quantityValid =
    quantity.length > 0 &&
    Number.isInteger(parsedQuantity) &&
    parsedQuantity >= 1;
  const displayImage =
    imageDraft ??
    resolveEntryImagePath(entry.imagePath, entry.product.imagePath);
  const displayName = nameDraft.trim() || t("common.noName");

  const discountChanged =
    !homeUser &&
    priceReducedDraft &&
    discountPercentDraft !== savedDiscountPercent;
  const hasChanges =
    Boolean(imageDraft) ||
    expiryYmd !== savedExpiryYmd ||
    (quantityValid && parsedQuantity !== entry.quantity) ||
    (!homeUser && priceReducedDraft !== savedPriceReduced) ||
    discountChanged ||
    articulDraft.trim() !== (entry.articul ?? "").trim() ||
    nameDraft.trim() !== entry.product.name.trim() ||
    barcodeDraft.trim() !== savedBarcodeDisplay.trim();
  const canConfirm = hasChanges && quantityValid;

  useEffect(() => {
    setQuantity(String(entry.quantity));
    setExpiryYmd(expiryIsoToYmd(entry.expiryDate));
    setPriceReducedDraft(entry.priceReducedAt !== null);
    setDiscountPercentDraft(
      entry.priceDiscountPercent ?? DEFAULT_DISCOUNT_PERCENT,
    );
    setArticulDraft(entry.articul ?? "");
    setNameDraft(entry.product.name);
    setBarcodeDraft(isAdhocBarcode(entry.barcode) ? "" : entry.barcode);
    setImageDraft(null);
    setChangingPicture(false);
    setEditingExpiry(false);
    setEditingName(false);
    setError(null);
  }, [
    entry.id,
    entry.quantity,
    entry.expiryDate,
    entry.priceReducedAt,
    entry.priceDiscountPercent,
    entry.articul,
    entry.imagePath,
    entry.barcode,
    entry.product.name,
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

  // Bring the calendar into the visible sheet area on small screens so it is
  // not hidden under Save/Cancel when opened from the lower half of the form.
  useEffect(() => {
    if (!editingExpiry) return;
    const section = expirySectionRef.current;
    const scroller = sheetScrollRef.current;
    if (!section || !scroller) return;

    let cancelled = false;
    const frame = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (cancelled) return;
        const sectionRect = section.getBoundingClientRect();
        const scrollerRect = scroller.getBoundingClientRect();
        const nextTop =
          scroller.scrollTop + (sectionRect.top - scrollerRect.top) - 8;
        scroller.scrollTo({ top: Math.max(0, nextTop), behavior: "smooth" });
      });
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
  }, [editingExpiry]);

  async function confirmChanges() {
    const flushed = editingExpiry ? datePickerRef.current?.flush() : null;
    const effectiveExpiry = flushed ?? expiryYmd;
    if (flushed && flushed !== expiryYmd) setExpiryYmd(flushed);

    const qtyValid =
      quantity.length > 0 &&
      Number.isInteger(Number(quantity)) &&
      Number(quantity) >= 1;
    if (!qtyValid) return;

    const nextHasChanges =
      Boolean(imageDraft) ||
      effectiveExpiry !== savedExpiryYmd ||
      Number(quantity) !== entry.quantity ||
      (!homeUser && priceReducedDraft !== savedPriceReduced) ||
      (!homeUser &&
        priceReducedDraft &&
        discountPercentDraft !== savedDiscountPercent) ||
      articulDraft.trim() !== (entry.articul ?? "").trim() ||
      nameDraft.trim() !== entry.product.name.trim() ||
      barcodeDraft.trim() !== savedBarcodeDisplay.trim();
    if (!nextHasChanges) return;

    setSaving(true);
    setError(null);

    try {
      const body: Record<string, unknown> = {
        entryId: entry.id,
        storeId,
      };
      if (imageDraft) {
        body.imagePath = await uploadImage(imageDraft);
      }
      if (Number(quantity) !== entry.quantity) {
        body.quantity = Number(quantity);
      }
      if (effectiveExpiry !== savedExpiryYmd) {
        body.expiryDate = expiryYmdToIso(effectiveExpiry);
      }
      if (!homeUser) {
        if (priceReducedDraft !== savedPriceReduced) {
          body.priceReduced = priceReducedDraft;
          if (priceReducedDraft) {
            body.priceDiscountPercent = discountPercentDraft;
          }
        } else if (priceReducedDraft && discountChanged) {
          body.priceReduced = true;
          body.priceDiscountPercent = discountPercentDraft;
        }
      }
      if (articulDraft.trim() !== (entry.articul ?? "").trim()) {
        body.articul = articulDraft.trim() || null;
      }
      if (nameDraft.trim() !== entry.product.name.trim()) {
        body.name = nameDraft.trim();
      }
      if (barcodeDraft.trim() !== savedBarcodeDisplay.trim()) {
        body.barcode = barcodeDraft.trim() || null;
      }

      const response = await fetch("/api/inventory", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = ((await response.json().catch(() => null)) ?? {}) as {
        entry?: ExpiryDetailEntry;
        merged?: boolean;
        removedId?: string;
        error?: string;
      };

      if (!response.ok || !data.entry) {
        setError(data.error ?? t("expiry.saveFailed"));
        return;
      }

      onUpdated(data.entry, {
        merged: data.merged,
        removedId: data.removedId,
      });
      setEditingExpiry(false);
      onClose();
    } catch (err) {
      setError(
        err instanceof Error && err.message
          ? err.message
          : t("expiry.saveFailed"),
      );
    } finally {
      setSaving(false);
    }
  }

  const expiryDisplay = useMemo(
    () => formatLocaleDay(expiryYmd, dateLocale, { utc: true }),
    [expiryYmd, dateLocale],
  );

  const daysLeft = useMemo(() => {
    const ymd = /^(\d{4})-(\d{2})-(\d{2})$/.exec(expiryYmd.trim());
    const date = ymd
      ? new Date(Date.UTC(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3])))
      : new Date(expiryYmd);
    return daysUntilExpiry(date);
  }, [expiryYmd]);

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

      <div
        ref={sheetScrollRef}
        className={`min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-4 ${
          editingExpiry ? "pb-28" : "pb-3"
        }`}
      >
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
                {t("expiry.changePhotoButton")}
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
                  label={t("expiry.copyName")}
                  copiedLabel={t("expiry.copied")}
                />
                {onToggleFavourite ? (
                  <button
                    type="button"
                    aria-label={
                      favourite ? t("favourites.remove") : t("favourites.add")
                    }
                    className={`mt-0.5 shrink-0 ${
                      favourite ? "text-amber-400" : "text-muted"
                    }`}
                    onClick={onToggleFavourite}
                    disabled={saving}
                  >
                    <StarFavouriteIcon className="size-5" filled={favourite} />
                  </button>
                ) : null}
              </div>

              <div className="mt-auto space-y-0 pt-1.5">
                <label className="block">
                  <span className="text-[10px] font-medium leading-none text-muted">
                    {t("expiry.articul")}
                  </span>
                  <input
                    className="mt-px h-8 w-full rounded-md border border-card-border bg-transparent px-1.5 text-sm leading-none text-foreground outline-none focus:border-primary"
                    value={articulDraft}
                    onChange={(event) => setArticulDraft(event.target.value)}
                    disabled={saving}
                  />
                </label>
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
                      label={t("expiry.copyBarcode")}
                      copiedLabel={t("expiry.copied")}
                    />
                  </div>
                </label>
              </div>
            </div>
          </div>
        </div>

        {!homeUser ? (
          <div className="mt-3 rounded-2xl border border-card-border px-3 py-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">
                  {t("expiry.priceReduced")}
                </p>
                <p className="mt-0.5 text-xs text-muted">
                  {t("expiry.priceReducedHint")}
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={priceReducedDraft}
                aria-label={t("expiry.priceReduced")}
                className={`relative h-7 w-11 shrink-0 rounded-full border p-0.5 transition-colors ${
                  priceReducedDraft
                    ? "border-primary bg-primary"
                    : "border-card-border bg-transparent"
                }`}
                onClick={() => {
                  setPriceReducedDraft((current) => {
                    const next = !current;
                    if (next && !priceReducedDraft) {
                      setDiscountPercentDraft(
                        entry.priceDiscountPercent ?? DEFAULT_DISCOUNT_PERCENT,
                      );
                    }
                    return next;
                  });
                }}
                disabled={saving}
              >
                <span
                  className={`block size-5 rounded-full transition-transform ${
                    priceReducedDraft
                      ? "translate-x-4 bg-primary-fg"
                      : "translate-x-0 bg-muted"
                  }`}
                />
              </button>
            </div>
            {priceReducedDraft ? (
              <div className="mt-3 border-t border-card-border pt-3">
                <DiscountPercentPicker
                  value={discountPercentDraft}
                  onChange={setDiscountPercentDraft}
                />
                {savedPriceReduced && entry.priceReducedByUser?.username ? (
                  <div className="mt-3 flex items-end justify-between gap-2 border-t border-card-border pt-3">
                    <div className="min-w-0">
                      <p className="text-xs text-muted">
                        {t("expiry.reducedBy")}
                      </p>
                      <p className="truncate text-sm font-semibold text-foreground">
                        {entry.priceReducedByUser.username}
                      </p>
                    </div>
                    {entry.priceReducedAt ? (
                      <p className="shrink-0 text-[11px] text-muted">
                        {formatLocaleDay(entry.priceReducedAt, dateLocale)}
                        {" · "}
                        {formatLocaleTime(entry.priceReducedAt, dateLocale)}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

        <div ref={expirySectionRef} className="mt-3 scroll-mt-2">
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-2xl border border-card-border p-2.5">
              <p className="text-[10px] font-medium text-muted">
                {t("common.quantity")}
              </p>
              <div className="mt-2 flex justify-center">
                <QuantityStepper value={quantity} onChange={setQuantity} />
              </div>
            </div>

            <div className="rounded-2xl border border-card-border p-2.5">
              <p className="text-[10px] font-medium text-muted">
                {t("expiry.expiryDateLabel")}
              </p>
              <button
                type="button"
                className={`mt-2 flex w-full items-center gap-1.5 rounded-lg border px-2 py-1.5 text-left ${
                  editingExpiry
                    ? "border-primary bg-selected"
                    : "border-card-border bg-transparent"
                }`}
                onClick={() => setEditingExpiry((open) => !open)}
                disabled={saving}
                aria-expanded={editingExpiry}
              >
                <CalendarIcon className="size-3.5 shrink-0 text-muted" />
                <span className="min-w-0 truncate text-xs font-semibold text-foreground">
                  {expiryDisplay}
                </span>
              </button>
              <p
                className={`mt-1.5 text-[11px] font-medium ${
                  daysLeft < 0 ? "text-error" : "text-primary"
                }`}
              >
                {daysRemainingLabel(daysLeft, t)}
              </p>
            </div>
          </div>

          {editingExpiry ? (
            <div className="mt-3 rounded-2xl border border-primary/40 bg-selected/30 p-2">
              <ExpiryDatePicker
                ref={datePickerRef}
                value={expiryYmd}
                onChange={(next) => {
                  setExpiryYmd(next);
                  setError(null);
                }}
                allowPast
              />
            </div>
          ) : null}
        </div>

        {entry.addedByUser?.username ? (
          <div className="mt-3 flex items-end justify-between gap-2 rounded-2xl border border-card-border px-3 py-2.5">
            <div className="min-w-0">
              <p className="text-xs text-muted">{t("expiry.addedBy")}</p>
              <p className="truncate text-sm font-semibold text-foreground">
                {entry.addedByUser.username}
              </p>
            </div>
            {entry.enteredAt ? (
              <p className="shrink-0 text-[11px] text-muted">
                {formatLocaleDay(entry.enteredAt, dateLocale)}
                {" · "}
                {formatLocaleTime(entry.enteredAt, dateLocale)}
              </p>
            ) : null}
          </div>
        ) : null}

        {error ? (
          <p className="mt-2 text-sm text-danger" role="alert">
            {error}
          </p>
        ) : null}
      </div>

      <div className="shrink-0 border-t border-card-border px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))]">
        <div className={appFooterButtonGrid}>
          <CancelButton onClick={onClose} disabled={saving}>
            {t("expiry.confirmCancel")}
          </CancelButton>
          <ConfirmButton
            busy={saving}
            disabled={!canConfirm}
            onClick={() => void confirmChanges()}
          >
            {t("expiry.saveChangesButton")}
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

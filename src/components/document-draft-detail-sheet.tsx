"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ExpiryDatePicker,
  type ExpiryDatePickerHandle,
} from "@/components/expiry-date-picker";
import { QuantityStepper } from "@/components/quantity-picker";
import { CalendarIcon, CopyIcon } from "@/components/app-nav-icons";
import { ProductImage } from "@/components/product-image";
import { MobilePageHeader } from "@/components/mobile-page-header";
import { useT } from "@/components/i18n-provider";
import { useViewportInsets } from "@/hooks/use-viewport-insets";
import { CancelButton } from "@/components/cancel-button";
import { ConfirmButton } from "@/components/confirm-button";
import { appFooterButtonGrid } from "@/lib/app-ui";
import { daysUntilExpiry, formatLocaleDay } from "@/lib/expiry";
import {
  type DocumentDraftItem,
  draftItemValid,
  draftMissingExpiry,
} from "@/lib/document-draft";

type Props = {
  item: DocumentDraftItem;
  onClose: () => void;
  onSave: (patch: Partial<DocumentDraftItem>) => void;
};

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

export function DocumentDraftDetailSheet({ item, onClose, onSave }: Props) {
  const { t, dateLocale } = useT();
  const { offsetTop, keyboardInset } = useViewportInsets();
  const datePickerRef = useRef<ExpiryDatePickerHandle>(null);
  const sheetScrollRef = useRef<HTMLDivElement>(null);
  const expirySectionRef = useRef<HTMLDivElement>(null);
  const [nameDraft, setNameDraft] = useState(item.name);
  const [barcodeDraft, setBarcodeDraft] = useState(item.barcode);
  const [articulDraft, setArticulDraft] = useState(item.articul);
  const [quantity, setQuantity] = useState(item.quantity);
  const [expiryYmd, setExpiryYmd] = useState(item.expiryYmd);
  const [editingExpiry, setEditingExpiry] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [saving, setSaving] = useState(false);

  const savedExpiryYmd = item.expiryYmd;
  const parsedQuantity = Number(quantity);
  const quantityValid =
    quantity.length > 0 &&
    Number.isInteger(parsedQuantity) &&
    parsedQuantity >= 1;
  const displayName = nameDraft.trim() || t("common.noName");
  const missingExpiry = draftMissingExpiry({
    ...item,
    expiryYmd,
  });

  const hasChanges =
    expiryYmd !== savedExpiryYmd ||
    (quantityValid && parsedQuantity !== Number(item.quantity)) ||
    articulDraft.trim() !== item.articul.trim() ||
    nameDraft.trim() !== item.name.trim() ||
    barcodeDraft.trim() !== item.barcode.trim();
  const canConfirm = hasChanges && quantityValid;

  useEffect(() => {
    setNameDraft(item.name);
    setBarcodeDraft(item.barcode);
    setArticulDraft(item.articul);
    setQuantity(item.quantity);
    setExpiryYmd(item.expiryYmd);
    setEditingExpiry(false);
    setEditingName(false);
    setSaving(false);
  }, [
    item.key,
    item.name,
    item.barcode,
    item.articul,
    item.quantity,
    item.expiryYmd,
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
  }, [editingExpiry, item.key]);

  const expiryDisplay = useMemo(() => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(expiryYmd)) {
      return t("addDocument.missingExpiry");
    }
    return formatLocaleDay(expiryYmd, dateLocale, { utc: true });
  }, [expiryYmd, dateLocale, t]);

  const daysLeft = useMemo(() => {
    const ymd = /^(\d{4})-(\d{2})-(\d{2})$/.exec(expiryYmd.trim());
    if (!ymd) return null;
    const date = new Date(
      Date.UTC(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3])),
    );
    return daysUntilExpiry(date);
  }, [expiryYmd]);

  function confirmChanges() {
    const flushed = editingExpiry ? datePickerRef.current?.flush() : null;
    const effectiveExpiry = flushed ?? expiryYmd;
    if (flushed && flushed !== expiryYmd) setExpiryYmd(flushed);

    const nextDraft: DocumentDraftItem = {
      ...item,
      name: nameDraft,
      barcode: barcodeDraft,
      articul: articulDraft,
      quantity,
      expiryYmd: effectiveExpiry,
    };
    if (!draftItemValid(nextDraft)) {
      setExpiryYmd(effectiveExpiry);
      return;
    }

    setSaving(true);
    onSave({
      name: nameDraft,
      barcode: barcodeDraft,
      articul: articulDraft,
      quantity,
      expiryYmd: effectiveExpiry,
      productId:
        barcodeDraft.trim() !== item.barcode.trim() ? null : item.productId,
      productImagePath:
        barcodeDraft.trim() !== item.barcode.trim()
          ? null
          : item.productImagePath,
      matchSource:
        barcodeDraft.trim() !== item.barcode.trim() ? null : item.matchSource,
      ...(nameDraft.trim() !== item.name.trim() ||
      barcodeDraft.trim() !== item.barcode.trim() ||
      articulDraft.trim() !== item.articul.trim()
        ? {
            zambooGid: null,
            zambooName: null,
            zambooCode: null,
            zambooMatch: null,
            zambooConfidence: null,
          }
        : {}),
    });
    onClose();
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
                src={item.productImagePath}
                alt={displayName}
                className="aspect-square w-full rounded-xl object-cover"
                placeholderClassName="aspect-square w-full rounded-xl text-xs"
              />
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
                  text={nameDraft.trim() || item.name}
                  label={t("expiry.copyName")}
                  copiedLabel={t("expiry.copied")}
                />
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
                      text={barcodeDraft.trim() || item.barcode}
                      label={t("expiry.copyBarcode")}
                      copiedLabel={t("expiry.copied")}
                    />
                  </div>
                </label>
              </div>
            </div>
          </div>
        </div>

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
                <span
                  className={`min-w-0 truncate text-xs font-semibold ${
                    missingExpiry ? "text-error" : "text-foreground"
                  }`}
                >
                  {expiryDisplay}
                </span>
              </button>
              <p
                className={`mt-1.5 text-[11px] font-medium ${
                  missingExpiry
                    ? "text-warning-fg"
                    : daysLeft !== null && daysLeft <= 0
                      ? "text-error"
                      : "text-primary"
                }`}
              >
                {missingExpiry
                  ? t("addDocument.missingExpiry")
                  : daysLeft === null
                    ? t("addDocument.missingExpiry")
                    : daysRemainingLabel(daysLeft, t)}
              </p>
            </div>
          </div>

          {editingExpiry ? (
            <div className="mt-3 rounded-2xl border border-primary/40 bg-selected/30 p-2">
              <ExpiryDatePicker
                ref={datePickerRef}
                value={expiryYmd}
                onChange={setExpiryYmd}
                allowPast
              />
            </div>
          ) : null}
        </div>
      </div>

      <div className="shrink-0 border-t border-card-border px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))]">
        <div className={appFooterButtonGrid}>
          <CancelButton onClick={onClose} disabled={saving}>
            {t("expiry.confirmCancel")}
          </CancelButton>
          <ConfirmButton
            busy={saving}
            disabled={!canConfirm}
            onClick={() => confirmChanges()}
          >
            {t("expiry.saveChangesButton")}
          </ConfirmButton>
        </div>
      </div>
    </div>
  );
}

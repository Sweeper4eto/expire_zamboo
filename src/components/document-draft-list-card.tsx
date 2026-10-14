"use client";

import { WarningIcon } from "@/components/app-nav-icons";
import { ProductImage } from "@/components/product-image";
import { useT } from "@/components/i18n-provider";
import { daysUntilExpiry, formatLocaleDay } from "@/lib/expiry";
import {
  type DocumentDraftItem,
  draftMissingExpiry,
  draftMissingName,
} from "@/lib/document-draft";

type Props = {
  item: DocumentDraftItem;
  onOpen: () => void;
  onRemove: () => void;
};

const missingExpiryBadgeClass =
  "border-[var(--urgency-warning-border)] bg-[var(--urgency-warning-bg)] text-warning-fg";

const expiredBadgeClass =
  "border-[var(--urgency-critical-border)] bg-[var(--urgency-critical-bg)] text-error";

const neutralDaysBadgeClass =
  "border-card-border bg-transparent text-foreground";

export function DocumentDraftListCard({
  item,
  onOpen,
  onRemove,
}: Props) {
  const { t, dateLocale } = useT();
  const missingExpiry = draftMissingExpiry(item);
  const displayName = item.name.trim() || t("common.noName");
  const qty = Number(item.quantity);
  const quantity =
    Number.isInteger(qty) && qty >= 1 ? qty : Number(item.quantity) || 1;

  const expiry = !missingExpiry
    ? new Date(`${item.expiryYmd}T00:00:00.000Z`)
    : null;
  const days = expiry ? daysUntilExpiry(expiry) : null;
  // Document review only: red when expired or within 3 days. Expiry list keeps ≤7 etc.
  const isRedPreview = days !== null && days <= 3;
  const absDays = days === null ? 0 : Math.abs(days);
  const daysLabel =
    days === 0
      ? t("expiry.today")
      : absDays === 1
        ? t("expiry.day")
        : t("expiry.days");

  const stripeClass = missingExpiry
    ? "bg-[var(--urgency-warning-border)]"
    : isRedPreview
      ? "bg-[var(--urgency-critical-border)]"
      : "bg-card-border";

  const daysBadgeClass = missingExpiry
    ? missingExpiryBadgeClass
    : isRedPreview
      ? expiredBadgeClass
      : neutralDaysBadgeClass;

  return (
    <article className="flex w-full overflow-hidden rounded-xl border border-card-border bg-transparent">
      <div className={`w-1 shrink-0 self-stretch ${stripeClass}`} aria-hidden />

      <div className="flex min-w-0 flex-1 items-start gap-1 px-1 py-1">
        <button
          type="button"
          aria-label={t("addDocument.editItem")}
          className="flex min-w-0 flex-1 items-center gap-1.5 self-center text-left"
          onClick={onOpen}
        >
          <ProductImage
            src={item.productImagePath}
            alt=""
            className="size-12 shrink-0 rounded-lg object-cover"
            placeholderClassName="size-12 shrink-0 rounded-lg text-[9px]"
          />

          <div className="min-w-0 flex-1">
            <p
              className={`line-clamp-2 text-sm font-semibold leading-tight ${
                draftMissingName(item) ? "text-muted" : "text-foreground"
              }`}
            >
              {displayName}
            </p>
            {missingExpiry ? (
              <p
                className={`mt-0.5 inline-flex max-w-full items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold leading-tight ${missingExpiryBadgeClass}`}
              >
                <WarningIcon className="size-3 shrink-0" />
                <span className="truncate">{t("addDocument.missingExpiry")}</span>
              </p>
            ) : isRedPreview ? (
              <p
                className={`mt-0.5 inline-flex max-w-full items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold leading-tight ${expiredBadgeClass}`}
              >
                <WarningIcon className="size-3 shrink-0" />
                <span className="truncate">
                  {t("expiry.validUntil")}{" "}
                  {formatLocaleDay(item.expiryYmd, dateLocale, { utc: true })}
                </span>
              </p>
            ) : (
              <p className="whitespace-nowrap text-[12px] leading-tight text-primary">
                <span className="text-[10px] font-semibold text-primary/80">
                  {t("expiry.validUntil")}
                </span>{" "}
                <span className="font-bold tabular-nums text-primary">
                  {formatLocaleDay(item.expiryYmd, dateLocale, { utc: true })}
                </span>
              </p>
            )}
          </div>

          <div className="flex shrink-0 items-stretch gap-0.5">
            <div className="flex h-[2.375rem] w-9 flex-col items-center justify-center rounded-md border border-card-border bg-transparent px-0.5 py-0.5 text-center">
              <p className="text-base font-bold leading-none tabular-nums text-foreground">
                {quantity}
              </p>
              <p className="text-[10px] font-semibold leading-none text-muted">
                {t("expiry.pieces")}
              </p>
            </div>

            <div
              className={`flex h-[2.375rem] w-9 flex-col items-center justify-center rounded-md border px-0.5 py-0.5 text-center ${daysBadgeClass}`}
            >
              {missingExpiry ? (
                <WarningIcon className="size-4 shrink-0" aria-hidden />
              ) : days === 0 ? (
                <p className="text-[10px] font-bold leading-tight">{daysLabel}</p>
              ) : days === null ? (
                <p className="text-[10px] font-bold leading-tight">—</p>
              ) : (
                <>
                  <p className="text-base font-bold leading-none tabular-nums">
                    {days}
                  </p>
                  <p
                    className={`max-w-full truncate text-[10px] font-semibold leading-none ${
                      isRedPreview ? "" : "text-muted"
                    }`}
                  >
                    {daysLabel}
                  </p>
                </>
              )}
            </div>
          </div>
        </button>

        <button
          type="button"
          aria-label={t("expiry.remove")}
          className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md border border-card-border bg-transparent text-base leading-none text-muted"
          onClick={(event) => {
            event.stopPropagation();
            onRemove();
          }}
        >
          ×
        </button>
      </div>
    </article>
  );
}

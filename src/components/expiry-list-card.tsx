"use client";

import { useRef } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { useT } from "@/components/i18n-provider";
import { ProductImage } from "@/components/product-image";
import {
  MoveToOrdersIcon,
  PriceReduceIcon,
  StarFavouriteIcon,
} from "@/components/app-nav-icons";
import {
  daysUntilExpiry,
  expiryUrgencyBadgeClass,
  expiryUrgencyStripeClass,
  formatLocaleDay,
} from "@/lib/expiry";

const LONG_PRESS_MS = 450;

type Props = {
  name: string;
  imagePath: string | null;
  articul?: string | null;
  expiryDate: string;
  enteredAt: string;
  quantity: number;
  priceReduced: boolean;
  /** Shown when price is reduced (e.g. 25 → "-25%"). */
  discountPercent?: number | null;
  homeUser?: boolean;
  favourite?: boolean;
  /** View-only cards hide action chips (used in admin store expiry). */
  mode?: "full" | "view";
  selectionMode?: boolean;
  selected?: boolean;
  onOpen: () => void;
  onRemove: () => void;
  onReducePrice: () => void;
  onMoveToOrders?: () => void;
  onToggleFavourite?: () => void;
  onLongPressSelect?: () => void;
  onToggleSelected?: () => void;
};

export function ExpiryListCard({
  name,
  imagePath,
  articul: _articul,
  expiryDate,
  enteredAt,
  quantity,
  priceReduced,
  discountPercent = null,
  homeUser = false,
  favourite = false,
  mode = "full",
  selectionMode = false,
  selected = false,
  onOpen,
  onRemove,
  onReducePrice,
  onMoveToOrders,
  onToggleFavourite,
  onLongPressSelect,
  onToggleSelected,
}: Props) {
  const { t, dateLocale } = useT();
  const expiry = new Date(expiryDate);
  const entered = new Date(enteredAt);
  const days = daysUntilExpiry(expiry);
  const absDays = Math.abs(days);
  const daysLabel =
    days === 0
      ? t("expiry.today")
      : absDays === 1
        ? t("expiry.day")
        : t("expiry.days");
  const viewOnly = mode === "view";
  const longPressTimer = useRef<number | null>(null);
  const longPressTriggered = useRef(false);
  const pointerStart = useRef<{ x: number; y: number } | null>(null);

  function clearLongPress() {
    if (longPressTimer.current !== null) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }

  function handlePointerDown(event: ReactPointerEvent) {
    if (viewOnly || selectionMode || !onLongPressSelect) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    longPressTriggered.current = false;
    pointerStart.current = { x: event.clientX, y: event.clientY };
    clearLongPress();
    longPressTimer.current = window.setTimeout(() => {
      longPressTriggered.current = true;
      longPressTimer.current = null;
      onLongPressSelect();
    }, LONG_PRESS_MS);
  }

  function handlePointerMove(event: ReactPointerEvent) {
    if (!pointerStart.current || longPressTimer.current === null) return;
    const dx = Math.abs(event.clientX - pointerStart.current.x);
    const dy = Math.abs(event.clientY - pointerStart.current.y);
    if (dx > 10 || dy > 10) clearLongPress();
  }

  function handlePointerEnd() {
    clearLongPress();
    pointerStart.current = null;
  }

  function handleMainClick() {
    if (longPressTriggered.current) {
      longPressTriggered.current = false;
      return;
    }
    if (selectionMode) {
      onToggleSelected?.();
      return;
    }
    onOpen();
  }

  return (
    <article
      className={`flex w-full overflow-hidden rounded-xl border transition-colors ${
        selected
          ? "border-primary bg-selected"
          : "border-card-border bg-transparent"
      } ${selectionMode ? "cursor-pointer" : ""}`}
      aria-pressed={selectionMode ? selected : undefined}
      onClick={
        selectionMode
          ? () => {
              if (longPressTriggered.current) {
                longPressTriggered.current = false;
                return;
              }
              onToggleSelected?.();
            }
          : undefined
      }
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
      onPointerLeave={handlePointerEnd}
      onContextMenu={(event) => {
        if (!viewOnly && onLongPressSelect) event.preventDefault();
      }}
    >
      <div
        className={`w-1 shrink-0 self-stretch ${expiryUrgencyStripeClass(expiry)}`}
        aria-hidden
      />

      <div className="flex min-w-0 flex-1 items-start gap-1 px-1 py-1">
        {!selectionMode && !viewOnly && homeUser ? (
          <button
            type="button"
            aria-label={t("expiry.moveToOrders")}
            title={t("expiry.moveToOrders")}
            className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md border border-card-border bg-transparent text-muted"
            onClick={(event) => {
              event.stopPropagation();
              onMoveToOrders?.();
            }}
          >
            <MoveToOrdersIcon className="size-3.5" />
          </button>
        ) : null}

        {!selectionMode && !homeUser && priceReduced ? (
          viewOnly ? (
            <span
              className="mt-0.5 shrink-0 text-[10px] font-bold leading-none tabular-nums text-primary"
              title={t("expiry.priceReduced")}
              aria-label={t("expiry.priceReduced")}
            >
              −{discountPercent ?? 25}%
            </span>
          ) : (
            <button
              type="button"
              aria-label={t("expiry.editDiscount")}
              title={t("expiry.editDiscount")}
              className="mt-0.5 shrink-0 text-[10px] font-bold leading-none tabular-nums text-primary"
              onClick={(event) => {
                event.stopPropagation();
                onReducePrice();
              }}
            >
              −{discountPercent ?? 25}%
            </button>
          )
        ) : !selectionMode && !viewOnly && !homeUser ? (
          <button
            type="button"
            aria-label={t("expiry.reducePrice")}
            title={t("expiry.reducePrice")}
            className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md border border-card-border bg-transparent text-muted"
            onClick={(event) => {
              event.stopPropagation();
              onReducePrice();
            }}
          >
            <PriceReduceIcon className="size-3.5" />
          </button>
        ) : null}

        <div className="flex min-w-0 flex-1 items-center gap-1.5 self-center">
          <div className="relative size-12 shrink-0">
            <ProductImage
              src={imagePath}
              alt=""
              className="size-12 rounded-lg object-cover"
              placeholderClassName="size-12 rounded-lg text-[9px]"
            />
            {!selectionMode && !viewOnly && homeUser && onToggleFavourite ? (
              <button
                type="button"
                aria-label={favourite ? t("favourites.remove") : t("favourites.add")}
                title={favourite ? t("favourites.remove") : t("favourites.add")}
                className={`absolute -right-0.5 -top-0.5 flex size-5 items-center justify-center rounded-md border border-card-border bg-background/95 ${
                  favourite ? "text-amber-400" : "text-muted"
                }`}
                onClick={(event) => {
                  event.stopPropagation();
                  onToggleFavourite();
                }}
              >
                <StarFavouriteIcon className="size-3" filled={favourite} />
              </button>
            ) : null}
          </div>

          <button
            type="button"
            aria-label={
              selectionMode ? t("expiry.selectItem") : t("expiry.viewEntry")
            }
            className="flex min-w-0 flex-1 basis-0 items-start gap-1.5 overflow-hidden text-left"
            onClick={(event) => {
              if (selectionMode) {
                event.stopPropagation();
                handleMainClick();
                return;
              }
              handleMainClick();
            }}
            disabled={viewOnly && !selectionMode}
          >
            <div className="min-w-0 flex-1 overflow-hidden">
              <p
                title={name}
                className="line-clamp-2 break-words text-sm font-semibold leading-tight text-foreground"
              >
                {name}
              </p>
              <p className="mt-0.5 text-[10px] leading-tight text-muted">
                {t("expiry.enteredOn")} {formatLocaleDay(entered, dateLocale)}
              </p>
              <p className="whitespace-nowrap text-[12px] leading-tight text-primary">
                <span className="text-[10px] font-semibold text-primary/80">
                  {t("expiry.validUntil")}
                </span>{" "}
                <span className="font-bold tabular-nums text-primary">
                  {formatLocaleDay(expiry, dateLocale)}
                </span>
              </p>
            </div>

            <div className="flex shrink-0 items-stretch gap-0.5 self-center">
              <div className="flex h-[2.375rem] w-9 flex-col items-center justify-center rounded-md border border-card-border bg-transparent px-0.5 py-0.5 text-center">
                <p className="text-base font-bold leading-none tabular-nums text-foreground">
                  {quantity}
                </p>
                <p className="text-[10px] font-semibold leading-none text-muted">
                  {t("expiry.pieces")}
                </p>
              </div>

              <div
                className={`flex h-[2.375rem] w-9 flex-col items-center justify-center rounded-md border px-0.5 py-0.5 text-center ${expiryUrgencyBadgeClass(expiry)}`}
              >
                {days === 0 ? (
                  <p className="text-[10px] font-bold leading-tight">{daysLabel}</p>
                ) : (
                  <>
                    <p className="text-base font-bold leading-none tabular-nums">
                      {days}
                    </p>
                    <p className="max-w-full truncate text-[10px] font-semibold leading-none">
                      {daysLabel}
                    </p>
                  </>
                )}
              </div>
            </div>
          </button>
        </div>

        {!selectionMode && !viewOnly ? (
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
        ) : null}
      </div>
    </article>
  );
}

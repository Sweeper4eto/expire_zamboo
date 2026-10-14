"use client";

import { useT } from "@/components/i18n-provider";
import { formatLocaleDay, formatLocaleTime } from "@/lib/expiry";
import { ProductImage } from "@/components/product-image";
import {
  CheckIcon,
  MoveToExpiryIcon,
  StarFavouriteIcon,
} from "@/components/app-nav-icons";

const listQtyBadgeClass =
  "flex h-[2.375rem] w-9 flex-col items-center justify-center rounded-md border border-card-border bg-transparent px-0.5 py-0.5 text-center";

type Props = {
  name: string;
  imagePath: string | null;
  enteredAt: string;
  quantity: number;
  checked?: boolean;
  favourite?: boolean;
  onOpen: () => void;
  onRemove: () => void;
  onMoveToExpiry: () => void;
  onToggleFavourite: () => void;
  onToggleChecked?: () => void;
};

export function BuyListCard({
  name,
  imagePath,
  enteredAt,
  quantity,
  checked = false,
  favourite = false,
  onOpen,
  onRemove,
  onMoveToExpiry,
  onToggleFavourite,
  onToggleChecked,
}: Props) {
  const { t, dateLocale } = useT();
  const entered = new Date(enteredAt);

  return (
    <article
      className={`flex w-full overflow-hidden rounded-xl border ${
        checked
          ? "border-primary bg-selected"
          : "border-card-border bg-transparent"
      }`}
    >
      <div
        className={`w-1 shrink-0 self-stretch ${
          checked ? "bg-primary" : "bg-card-border"
        }`}
        aria-hidden
      />

      <div className="flex min-w-0 flex-1 items-start gap-1 px-1 py-1">
        <button
          type="button"
          aria-label={t("buyList.moveToExpiry")}
          title={t("buyList.moveToExpiry")}
          className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md border border-card-border bg-transparent text-muted"
          onClick={(event) => {
            event.stopPropagation();
            onMoveToExpiry();
          }}
        >
          <MoveToExpiryIcon className="size-3.5" />
        </button>

        <div className="flex min-w-0 flex-1 items-center gap-1.5 self-center">
          <div className="relative size-12 shrink-0">
            <ProductImage
              src={imagePath}
              alt=""
              className="size-12 rounded-lg object-cover"
              placeholderClassName="size-12 rounded-lg text-[9px]"
            />
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
          </div>

          <div className="flex min-w-0 flex-1 basis-0 items-start gap-1.5 overflow-hidden">
            <button
              type="button"
              aria-label={t("buyList.viewEntry")}
              className="min-w-0 flex-1 overflow-hidden text-left"
              onClick={onOpen}
            >
              <p
                title={name}
                className={`line-clamp-2 break-words text-sm font-semibold leading-tight ${
                  checked ? "text-foreground/70 line-through" : "text-foreground"
                }`}
              >
                {name}
              </p>
              <p className="mt-0.5 text-[10px] leading-tight text-muted">
                {t("buyList.enteredOn")} {formatLocaleDay(entered, dateLocale)}
              </p>
              <p className="whitespace-nowrap text-[12px] leading-tight text-muted tabular-nums">
                {formatLocaleTime(entered, dateLocale)}
              </p>
            </button>

            <div className="flex shrink-0 items-stretch gap-0.5 self-center">
              <div className={listQtyBadgeClass}>
                <p className="text-base font-bold leading-none tabular-nums text-foreground">
                  {quantity}
                </p>
                <p className="text-[10px] font-semibold leading-none text-muted">
                  {t("buyList.pieces")}
                </p>
              </div>

              {onToggleChecked ? (
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={checked}
                  aria-label={
                    checked ? t("buyList.markNotBought") : t("buyList.markBought")
                  }
                  title={
                    checked ? t("buyList.markNotBought") : t("buyList.markBought")
                  }
                  className={`${listQtyBadgeClass} transition-colors ${
                    checked
                      ? "border-primary bg-selected text-primary"
                      : "text-foreground"
                  }`}
                  onClick={(event) => {
                    event.stopPropagation();
                    onToggleChecked();
                  }}
                >
                  <span className="flex h-4 items-center justify-center">
                    {checked ? (
                      <CheckIcon className="size-3.5 shrink-0" />
                    ) : (
                      <span
                        aria-hidden
                        className="size-3.5 shrink-0 rounded-sm border-2 border-muted"
                      />
                    )}
                  </span>
                  <p
                    className={`truncate text-[10px] font-semibold leading-none ${
                      checked ? "text-primary" : "text-muted"
                    }`}
                  >
                    {t("buyList.done")}
                  </p>
                </button>
              ) : null}
            </div>
          </div>
        </div>

        <button
          type="button"
          aria-label={t("buyList.remove")}
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

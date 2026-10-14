"use client";

import { ProductImage } from "@/components/product-image";
import { QuantityStepper } from "@/components/quantity-picker";
import { useT } from "@/components/i18n-provider";
import { useViewportInsets } from "@/hooks/use-viewport-insets";
import { CancelButton } from "@/components/cancel-button";
import { ConfirmButton } from "@/components/confirm-button";
import { appFooterButtonGrid } from "@/lib/app-ui";

type Props = {
  itemName: string;
  imagePath: string | null;
  quantity: string;
  busy?: boolean;
  onQuantityChange: (value: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
};

export function MoveToCartConfirmDialog({
  itemName,
  imagePath,
  quantity,
  busy = false,
  onQuantityChange,
  onCancel,
  onConfirm,
}: Props) {
  const { t } = useT();
  const { offsetTop, keyboardInset } = useViewportInsets();
  const displayName = itemName.trim() || t("common.noName");

  return (
    <div
      className="fixed inset-x-0 z-[70] flex items-center justify-center bg-black/60 px-5"
      style={{ top: offsetTop, bottom: keyboardInset }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="move-to-cart-title"
      onClick={() => {
        if (!busy) onCancel();
      }}
    >
      <div
        className="w-full max-w-[22rem] rounded-2xl border border-card-border bg-background px-5 pb-5 pt-6 shadow-[0_20px_50px_rgba(0,0,0,0.5)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/icons/icon-192.png?v=10"
            alt=""
            width={112}
            height={112}
            className="size-28 object-contain"
            decoding="async"
          />
        </div>

        <h2
          id="move-to-cart-title"
          className="mt-4 text-center text-[1.35rem] font-semibold leading-tight text-foreground"
        >
          {t("expiry.moveToOrdersTitle")}
        </h2>

        <div className="mx-auto mt-5 max-w-[11rem]">
          <div className="flex flex-col items-center gap-2">
            <ProductImage
              src={imagePath}
              alt=""
              className="size-12 shrink-0 rounded-lg object-cover"
              placeholderClassName="size-12 shrink-0 rounded-lg text-[9px]"
            />
            <p
              title={displayName}
              className="w-full overflow-hidden text-center line-clamp-3 break-words text-sm font-semibold leading-tight text-foreground"
            >
              {displayName}
            </p>
          </div>
          <div className="mt-3 flex justify-center">
            <QuantityStepper
              value={quantity}
              onChange={onQuantityChange}
              min={1}
              max={500}
            />
          </div>
        </div>

        <div className={`mt-6 ${appFooterButtonGrid}`}>
          <CancelButton disabled={busy} onClick={onCancel}>
            {t("expiry.confirmCancel")}
          </CancelButton>
          <ConfirmButton
            busy={busy}
            disabled={
              !quantity ||
              !Number.isInteger(Number(quantity)) ||
              Number(quantity) < 1
            }
            onClick={onConfirm}
          >
            {t("expiry.moveToOrdersConfirm")}
          </ConfirmButton>
        </div>
      </div>
    </div>
  );
}

"use client";

import { CameraIcon } from "@/components/app-nav-icons";
import { ProductImage } from "@/components/product-image";
import { QuantityStepper } from "@/components/quantity-picker";
import { useT } from "@/components/i18n-provider";
import { CancelButton } from "@/components/cancel-button";
import { ConfirmButton } from "@/components/confirm-button";
import {
  appButtonCancelFull,
  appButtonNeutralFull,
  appFooterButtonGrid,
} from "@/lib/app-ui";

type Props = {
  name: string;
  imagePath: string | null;
  quantity: string;
  busy?: boolean;
  canConfirm?: boolean;
  canKeepOldPicture?: boolean;
  onNameChange: (value: string) => void;
  onQuantityChange: (value: string) => void;
  onAddPhoto: () => void;
  onKeepOldPicture?: () => void;
  onCancel: () => void;
  onConfirm: () => void;
};

export function ManualAddToCartDialog({
  name,
  imagePath,
  quantity,
  busy = false,
  canConfirm = true,
  canKeepOldPicture = false,
  onNameChange,
  onQuantityChange,
  onAddPhoto,
  onKeepOldPicture,
  onCancel,
  onConfirm,
}: Props) {
  const { t } = useT();

  return (
    <div
      className="fixed inset-0 z-[70] overflow-y-auto bg-black/60 px-5 py-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="manual-add-to-cart-title"
      onClick={() => {
        if (!busy) onCancel();
      }}
    >
      <div className="flex min-h-full items-center justify-center">
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
            id="manual-add-to-cart-title"
            className="mt-4 text-center text-[1.35rem] font-semibold leading-tight text-foreground"
          >
            {t("buyList.addManualTitle")}
          </h2>

          <div className="mx-auto mt-5 max-w-[11rem]">
            <div className="flex flex-col items-center gap-2">
              <ProductImage
                src={imagePath}
                alt=""
                className="size-12 shrink-0 rounded-lg object-cover"
                placeholderClassName="size-12 shrink-0 rounded-lg text-[9px]"
              />
              <input
                type="text"
                value={name}
                onChange={(event) => onNameChange(event.target.value)}
                disabled={busy}
                placeholder={t("common.noName")}
                aria-label={t("buyList.addManualName")}
                className="w-full bg-transparent text-center text-base font-semibold leading-tight text-foreground outline-none placeholder:text-muted"
              />
            </div>

            <p className="mt-3 text-center text-xs leading-relaxed text-muted">
              {t("buyList.addManualHint")}
            </p>

            <button
              type="button"
              disabled={busy}
              className={`${appButtonNeutralFull} mt-2 gap-1.5`}
              onClick={onAddPhoto}
            >
              <CameraIcon className="size-4 shrink-0 text-primary" />
              {imagePath ? t("camera.newPhoto") : t("buyList.addManualPhoto")}
            </button>
            {canKeepOldPicture && onKeepOldPicture ? (
              <button
                type="button"
                disabled={busy}
                className={`${appButtonCancelFull} mt-2`}
                onClick={onKeepOldPicture}
              >
                {t("camera.keepOldPicture")}
              </button>
            ) : null}

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
              {t("buyList.confirmCancel")}
            </CancelButton>
            <ConfirmButton
              busy={busy}
              disabled={
                !canConfirm ||
                !quantity ||
                !Number.isInteger(Number(quantity)) ||
                Number(quantity) < 1
              }
              onClick={onConfirm}
            >
              {t("buyList.addManualConfirm")}
            </ConfirmButton>
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import type { ReactNode } from "react";
import { appButtonDangerFull, appFooterButtonGrid } from "@/lib/app-ui";
import { CancelButton } from "@/components/cancel-button";
import { TrashIcon } from "@/components/app-nav-icons";
import { useViewportInsets } from "@/hooks/use-viewport-insets";

type Props = {
  title: string;
  /** Template containing `{item}` — the item label is rendered bold in place. */
  message: string;
  itemLabel: string;
  cancelLabel: string;
  removeLabel: string;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

function MessageWithItem({
  template,
  item,
}: {
  template: string;
  item: ReactNode;
}) {
  const marker = "{item}";
  const index = template.indexOf(marker);
  if (index < 0) {
    return (
      <>
        {template} <span className="font-semibold text-foreground">{item}</span>
      </>
    );
  }
  return (
    <>
      {template.slice(0, index)}
      <span className="font-semibold text-foreground">{item}</span>
      {template.slice(index + marker.length)}
    </>
  );
}

export function RemoveConfirmDialog({
  title,
  message,
  itemLabel,
  cancelLabel,
  removeLabel,
  busy = false,
  onCancel,
  onConfirm,
}: Props) {
  const { offsetTop, keyboardInset } = useViewportInsets();

  return (
    <div
      className="fixed inset-x-0 z-[70] flex items-center justify-center bg-black/60 px-5"
      style={{ top: offsetTop, bottom: keyboardInset }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="remove-confirm-title"
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
          id="remove-confirm-title"
          className="mt-4 text-center text-[1.35rem] font-semibold leading-tight text-foreground"
        >
          {title}
        </h2>

        <p className="mt-3 text-center text-[0.95rem] leading-relaxed text-muted">
          <MessageWithItem template={message} item={itemLabel} />
        </p>

        <div className={`mt-6 ${appFooterButtonGrid}`}>
          <CancelButton disabled={busy} onClick={onCancel}>
            {cancelLabel}
          </CancelButton>
          <button
            type="button"
            disabled={busy}
            className={`${appButtonDangerFull} gap-2`}
            onClick={onConfirm}
          >
            <TrashIcon className="size-4 shrink-0" />
            {removeLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

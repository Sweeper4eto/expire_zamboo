/**
 * Mobile app UI tokens — single source for buttons, insets, and common controls.
 * Reuse these in new work; do not invent new sizes/fonts per page.
 *
 * Buttons are always outline (never `bg-primary` fill).
 */

export const appPageShell = "mx-auto min-w-0 max-w-lg";

/** List cards / expiry-style rows */
export const appListInset = "px-1.5";

/** Headers, search rows when wider chrome is intended */
export const appChromeInset = "px-4";

const appButtonCore =
  "inline-flex items-center justify-center gap-1.5 rounded-xl border bg-transparent px-3 py-2.5 text-sm font-semibold disabled:opacity-50";

export const appButtonPrimary = `${appButtonCore} border-primary text-primary`;
export const appButtonNeutral = `${appButtonCore} border-card-border text-foreground`;
export const appButtonDanger = `${appButtonCore} border-danger text-danger`;

export const appButtonCancel = `${appButtonCore} border-white text-white`;

export const appButtonPrimaryFull = `w-full ${appButtonPrimary}`;
export const appButtonNeutralFull = `w-full ${appButtonNeutral}`;
export const appButtonDangerFull = `w-full ${appButtonDanger}`;
export const appButtonCancelFull = `w-full ${appButtonCancel}`;

const appButtonRowCore =
  "inline-flex w-full items-center justify-between rounded-xl border bg-transparent px-3 py-2.5 text-sm font-semibold disabled:opacity-50";

export const appButtonRowPrimary = `${appButtonRowCore} border-primary text-primary`;
export const appButtonRowNeutral = `${appButtonRowCore} border-card-border text-foreground`;

export const appFooterButtonGrid = "grid grid-cols-2 gap-2";

export const appSearchInput =
  "h-9 rounded-lg border border-input-border bg-input pl-2.5 text-base text-foreground";

export const appFormInput =
  "w-full rounded-xl border border-input-border bg-input px-3 py-2.5 text-base text-foreground";

export const appStatIconWrap =
  "flex size-8 shrink-0 items-center justify-center rounded-full border border-primary/45 text-primary";

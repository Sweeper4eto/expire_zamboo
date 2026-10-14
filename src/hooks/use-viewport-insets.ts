"use client";

import { useEffect, useState } from "react";

export type ViewportInsets = {
  /** Distance in px from the top of the layout viewport to the top of the visible area. */
  offsetTop: number;
  /** Extra space in px currently covered by the on-screen keyboard (or similar UI) at the bottom. */
  keyboardInset: number;
  /** Visible (visual) viewport height in px — use with `top` instead of `bottom` for fixed sheets. */
  height: number;
};

const IDLE_INSETS: ViewportInsets = { offsetTop: 0, keyboardInset: 0, height: 0 };

/**
 * Tracks how much of the layout viewport is currently obscured by the mobile
 * on-screen keyboard, using the `visualViewport` API.
 *
 * `position: fixed` elements are sized against the full layout viewport, which
 * on iOS Safari does NOT shrink when the keyboard opens (only the visual
 * viewport does). That leaves anything pinned near the bottom of a fixed
 * sheet (e.g. Save/Cancel buttons) rendered behind the keyboard with no way
 * to scroll it into view. Sheets can feed these insets back into inline
 * `top`/`height` (preferred) or `top`/`bottom` styles so they stay within
 * the actually-visible area.
 */
export function useViewportInsets(): ViewportInsets {
  const [insets, setInsets] = useState<ViewportInsets>(IDLE_INSETS);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) {
      setInsets({
        offsetTop: 0,
        keyboardInset: 0,
        height: window.innerHeight,
      });
      return;
    }

    function update() {
      const vv = window.visualViewport;
      if (!vv) return;
      const keyboardInset = Math.max(
        0,
        window.innerHeight - vv.height - vv.offsetTop,
      );
      setInsets({
        offsetTop: vv.offsetTop,
        keyboardInset,
        height: Math.max(0, Math.round(vv.height)),
      });
    }

    update();
    viewport.addEventListener("resize", update);
    viewport.addEventListener("scroll", update);
    return () => {
      viewport.removeEventListener("resize", update);
      viewport.removeEventListener("scroll", update);
    };
  }, []);

  return insets;
}

"use client";

import { useEffect } from "react";

function isEditableField(el: EventTarget | null): el is HTMLElement {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  if (tag === "TEXTAREA" || tag === "SELECT") return true;
  if (tag === "INPUT") {
    const type = (el as HTMLInputElement).type;
    // Skip non-text controls that don't open the soft keyboard.
    return ![
      "button",
      "checkbox",
      "radio",
      "file",
      "submit",
      "reset",
      "image",
      "range",
      "color",
      "hidden",
    ].includes(type);
  }
  return el.isContentEditable;
}

/** True when the field is already fully inside the visible (keyboard-aware) viewport. */
function isFullyVisible(el: HTMLElement): boolean {
  const rect = el.getBoundingClientRect();
  const vv = window.visualViewport;
  const top = vv?.offsetTop ?? 0;
  const bottom = top + (vv?.height ?? window.innerHeight);
  const pad = 12;
  return rect.top >= top + pad && rect.bottom <= bottom - pad;
}

/**
 * On focus / keyboard open, nudge the active field into view once.
 * Does not keep re-centering while the user scrolls to other fields.
 */
export function KeepKeyboardFocusVisible() {
  useEffect(() => {
    let timer: number | undefined;
    let focusedAt = 0;
    let suppressUntil = 0;

    function scrollActiveIntoView(force = false) {
      if (!force && Date.now() < suppressUntil) return;

      const el = document.activeElement;
      if (!isEditableField(el)) return;
      if (!force && isFullyVisible(el)) return;

      window.requestAnimationFrame(() => {
        if (document.activeElement !== el) return;
        if (!force && isFullyVisible(el)) return;
        el.scrollIntoView({
          block: "nearest",
          inline: "nearest",
          behavior: "auto",
        });
      });
    }

    function schedule(force = false) {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => scrollActiveIntoView(force), 80);
    }

    function onFocusIn(event: FocusEvent) {
      if (!isEditableField(event.target)) return;
      focusedAt = Date.now();
      // Allow one settle pass for the soft keyboard animation.
      schedule(true);
    }

    function onViewportResize() {
      // Only while the keyboard is still opening after a focus — not forever.
      if (Date.now() - focusedAt > 900) return;
      schedule(false);
    }

    function onUserScrollIntent() {
      // User is scrolling on purpose — don't yank back to the focused field.
      suppressUntil = Date.now() + 1500;
      window.clearTimeout(timer);
    }

    document.addEventListener("focusin", onFocusIn, true);
    document.addEventListener("touchmove", onUserScrollIntent, {
      capture: true,
      passive: true,
    });
    document.addEventListener("wheel", onUserScrollIntent, {
      capture: true,
      passive: true,
    });

    const viewport = window.visualViewport;
    viewport?.addEventListener("resize", onViewportResize);
    // Do not listen to visualViewport "scroll" — that fought user scrolling.

    return () => {
      document.removeEventListener("focusin", onFocusIn, true);
      document.removeEventListener("touchmove", onUserScrollIntent, true);
      document.removeEventListener("wheel", onUserScrollIntent, true);
      viewport?.removeEventListener("resize", onViewportResize);
      window.clearTimeout(timer);
    };
  }, []);

  return null;
}

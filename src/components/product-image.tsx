"use client";

import { useEffect, useRef, useState, type MouseEvent, type PointerEvent } from "react";
import { useT } from "@/components/i18n-provider";
import { NoPicturePlaceholder } from "@/components/no-picture-placeholder";

type Props = {
  src: string | null | undefined;
  alt: string;
  className?: string;
  placeholderClassName?: string;
  /** Hold ~0.5s or double-tap to change the picture. */
  onLongPress?: () => void;
};

const LONG_PRESS_MS = 450;
const DOUBLE_TAP_MS = 350;

export function ProductImage({
  src,
  alt,
  className = "",
  placeholderClassName = "",
  onLongPress,
}: Props) {
  const { t } = useT();
  const [broken, setBroken] = useState(false);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTapRef = useRef(0);
  const longPressFiredRef = useRef(false);
  const showImage = Boolean(src?.trim()) && !broken;

  useEffect(() => {
    setBroken(false);
  }, [src]);

  function clearPress() {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  }

  function clearTextSelection() {
    const selection = window.getSelection?.();
    selection?.removeAllRanges();
  }

  function triggerChange() {
    if (!onLongPress) return;
    clearTextSelection();
    onLongPress();
    // iOS sometimes applies the selection after the overlay mounts.
    window.setTimeout(clearTextSelection, 0);
    window.setTimeout(clearTextSelection, 50);
  }

  function startPress(event: PointerEvent) {
    if (!onLongPress) return;
    // Stop the browser from selecting nearby text while holding.
    event.preventDefault();
    clearPress();
    longPressFiredRef.current = false;
    pressTimer.current = setTimeout(() => {
      longPressFiredRef.current = true;
      lastTapRef.current = 0;
      triggerChange();
    }, LONG_PRESS_MS);
  }

  function onPointerUp(event: PointerEvent) {
    if (!onLongPress) return;
    // Ignore secondary buttons / multi-touch leftovers.
    if (event.pointerType === "mouse" && event.button !== 0) {
      clearPress();
      return;
    }
    clearPress();
    if (longPressFiredRef.current) {
      longPressFiredRef.current = false;
      return;
    }
    const now = Date.now();
    if (now - lastTapRef.current < DOUBLE_TAP_MS) {
      lastTapRef.current = 0;
      triggerChange();
      return;
    }
    lastTapRef.current = now;
  }

  function onContextMenu(event: MouseEvent) {
    if (!onLongPress) return;
    event.preventDefault();
    clearPress();
    triggerChange();
  }

  const interactiveProps = onLongPress
    ? {
        onPointerDown: startPress,
        onPointerUp,
        onPointerCancel: clearPress,
        onPointerLeave: clearPress,
        onContextMenu,
        style: {
          touchAction: "manipulation" as const,
          WebkitTouchCallout: "none" as const,
          WebkitUserSelect: "none" as const,
          userSelect: "none" as const,
        },
      }
    : {};

  if (!showImage) {
    return (
      <NoPicturePlaceholder
        className={`select-none ${placeholderClassName || className}`.trim()}
        role="img"
        aria-label={t("common.noPicture")}
        {...interactiveProps}
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src!}
      alt={alt}
      className={`select-none ${className}`.trim()}
      onError={() => setBroken(true)}
      draggable={false}
      {...interactiveProps}
    />
  );
}

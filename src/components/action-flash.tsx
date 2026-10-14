"use client";

import { useEffect } from "react";

type Props = {
  message: string | null;
  tone?: "success" | "error";
  onClear: () => void;
  durationMs?: number;
};

/**
 * Success/error flash pinned just above the app bottom nav so it does not
 * push page content and flicker the layout.
 */
export function ActionFlash({
  message,
  tone = "success",
  onClear,
  durationMs = 2500,
}: Props) {
  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(onClear, durationMs);
    return () => window.clearTimeout(timer);
  }, [message, durationMs, onClear]);

  if (!message) return null;

  const toneClass =
    tone === "error"
      ? "border-danger/30 bg-danger/10 text-danger"
      : "border-primary/30 bg-selected text-foreground";

  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={`pointer-events-none fixed inset-x-0 z-50 mx-auto w-[calc(100%-1.5rem)] max-w-lg rounded-xl border px-3 py-2.5 text-center text-sm font-medium backdrop-blur-sm ${toneClass}`}
      style={{
        bottom:
          "calc(var(--app-bottom-nav-height) + env(safe-area-inset-bottom, 0px) + 0.5rem)",
      }}
    >
      {message}
    </p>
  );
}

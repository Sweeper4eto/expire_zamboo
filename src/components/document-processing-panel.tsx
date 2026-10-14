"use client";

import { useEffect, useState } from "react";
import { LoadingSpinner } from "@/components/loading-spinner";
import { BrandName } from "@/components/brand-name";
import { useT } from "@/components/i18n-provider";
import { useScreenWakeLock } from "@/hooks/use-screen-wake-lock";

type Props = {
  /** 1-based page index when processing multiple uploads. */
  current?: number;
  total?: number;
  /** Files that failed OCR so far (shown live under the spinner). */
  failedFiles?: string[];
};

function FileRowIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M7 3h7l5 5v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
      <path d="M14 3v5h5" />
    </svg>
  );
}

export function DocumentProcessingPanel({
  current,
  total,
  failedFiles = [],
}: Props) {
  const { t } = useT();
  const [softProgress, setSoftProgress] = useState(0.14);
  const multi = Boolean(total && total > 0 && current && current > 0);

  // Keep the phone screen on for the whole OCR wait (panel is only mounted then).
  useScreenWakeLock(true);

  useEffect(() => {
    if (multi) return;
    setSoftProgress(0.14);
    const id = window.setInterval(() => {
      setSoftProgress((value) => {
        if (value >= 0.9) return value;
        return Math.min(0.9, value + 0.018 + Math.random() * 0.025);
      });
    }, 450);
    return () => window.clearInterval(id);
  }, [multi]);

  const progress = multi
    ? Math.min(1, Math.max(0.06, (current as number) / (total as number)))
    : softProgress;

  const status = multi
    ? t("addDocument.processingMulti", {
        current: current as number,
        total: total as number,
      })
    : t("addDocument.processing");

  return (
    <div className="relative overflow-hidden rounded-2xl border border-card-border bg-[radial-gradient(ellipse_at_center,rgb(16_185_129/0.08),transparent_65%)] px-6 pb-10 pt-14">
      <div className="mx-auto flex w-full max-w-sm flex-col items-center text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/landing/brand-mark.png?v=3"
          alt=""
          width={72}
          height={72}
          decoding="async"
          className="h-[4.5rem] w-[4.5rem] object-contain"
        />
        <BrandName className="mt-4 text-2xl leading-none" />
        <p className="mt-3 text-[11px] font-medium uppercase tracking-[0.22em] text-primary/90">
          {t("addDocument.processingLabel")}
        </p>

        <div className="mt-16 w-full space-y-3">
          <div
            className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-800"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress * 100)}
            aria-label={status}
          >
            <div
              className="document-processing-bar h-full rounded-full bg-primary transition-[width] duration-500 ease-out"
              style={{ width: `${Math.round(progress * 100)}%` }}
            />
          </div>
          <p className="text-sm text-foreground/90">{status}</p>
          <div className="flex justify-center pt-1" aria-hidden>
            <LoadingSpinner />
          </div>

          {failedFiles.length > 0 ? (
            <div className="w-full space-y-2 pt-4 text-left">
              <p className="text-xs font-medium text-muted">
                {t("addDocument.couldNotRead")}
              </p>
              <ul className="space-y-1.5">
                {failedFiles.map((name, index) => (
                  <li
                    key={`${name}-${index}`}
                    className="flex items-center gap-2 rounded-xl border border-error/35 bg-error/10 px-3 py-2"
                  >
                    <FileRowIcon className="h-4 w-4 shrink-0 text-error" />
                    <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                      {name}
                    </span>
                    <span className="shrink-0 text-xs font-medium text-error">
                      {t("addDocument.readFailed")}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

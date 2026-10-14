"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useMobileLocale } from "@/components/mobile-i18n-provider";
import type { MobileLocale } from "@/lib/client-locale";

function UkFlag({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 60 42"
      className={className}
      aria-hidden
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="60" height="42" rx="3" fill="#012169" />
      <path d="M0 0 L60 42 M60 0 L0 42" stroke="#fff" strokeWidth="9" />
      <path d="M0 0 L60 42 M60 0 L0 42" stroke="#C8102E" strokeWidth="5" />
      <path d="M30 0 V42 M0 21 H60" stroke="#fff" strokeWidth="14" />
      <path d="M30 0 V42 M0 21 H60" stroke="#C8102E" strokeWidth="8" />
    </svg>
  );
}

function BgFlag({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 60 42"
      className={className}
      aria-hidden
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="60" height="14" y="0" fill="#fff" />
      <rect width="60" height="14" y="14" fill="#00966E" />
      <rect width="60" height="14" y="28" fill="#D62612" />
      <rect
        width="60"
        height="42"
        rx="3"
        fill="none"
        stroke="rgb(255 255 255 / 0.15)"
        strokeWidth="1"
      />
    </svg>
  );
}

const bgLabel = String.fromCodePoint(0x0411, 0x0413);

const options: {
  value: MobileLocale;
  label: string;
  Flag: typeof UkFlag;
}[] = [
  { value: "en", label: "EN", Flag: UkFlag },
  { value: "bg", label: bgLabel, Flag: BgFlag },
];

export function LanguageSwitch() {
  const { locale, setLocale } = useMobileLocale();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const selected = options.find((option) => option.value === locale) ?? options[0];
  const Flag = selected.Flag;

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent | TouchEvent) {
      const target = event.target as Node | null;
      if (!rootRef.current || !target) return;
      if (!rootRef.current.contains(target)) setOpen(false);
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div
      ref={rootRef}
      className={`relative shrink-0 ${open ? "z-[90]" : "z-[50]"}`}
    >
      <button
        type="button"
        className="flex h-8 items-center gap-1.5 rounded-lg border border-input-border bg-transparent px-2 pr-1.5 text-xs text-foreground"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((value) => !value)}
      >
        <span>{selected.label}</span>
        <Flag className="h-3.5 w-5 shrink-0 rounded-[2px]" />
        <span className="shrink-0 text-[0.6rem] text-muted" aria-hidden>
          ▼
        </span>
      </button>

      {open ? (
        <ul
          id={listId}
          role="listbox"
          aria-label="Language"
          className="absolute right-0 top-full z-[100] mt-1 min-w-full overflow-hidden rounded-lg border border-input-border bg-zinc-950 py-1 shadow-lg shadow-black/50"
        >
          {options.map((option) => {
            const OptionFlag = option.Flag;
            const active = option.value === locale;
            return (
              <li key={option.value} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  className={`flex w-full items-center gap-1.5 px-2.5 py-2 text-left text-xs ${
                    active
                      ? "bg-selected text-primary"
                      : "bg-zinc-950 text-foreground hover:bg-zinc-900"
                  }`}
                  onClick={() => {
                    setLocale(option.value);
                    setOpen(false);
                  }}
                >
                  <span className="min-w-[1.5rem] font-medium">{option.label}</span>
                  <OptionFlag className="h-3.5 w-5 shrink-0 rounded-[2px]" />
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}


"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";

export type MenuSelectOption<T extends string> = {
  value: T;
  label: string;
  disabled?: boolean;
};

type MenuSelectProps<T extends string> = {
  value: T;
  options: MenuSelectOption<T>[];
  onChange: (value: T) => void;
  label: string;
  className?: string;
  buttonClassName?: string;
  disabled?: boolean;
  /** Shown when value is empty / not in options. */
  placeholder?: string;
  leadingIcon?: ReactNode;
  /** Compact header-style control (matches language switch). */
  size?: "field" | "compact";
  /** Align the menu to the start or end of the trigger. */
  menuAlign?: "start" | "end";
};

export function MenuSelect<T extends string>({
  value,
  options,
  onChange,
  label,
  className = "",
  buttonClassName = "",
  disabled = false,
  placeholder,
  leadingIcon,
  size = "field",
  menuAlign = "start",
}: MenuSelectProps<T>) {
  const [open, setOpen] = useState(false);
  const [menuAbove, setMenuAbove] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const selected = options.find((option) => option.value === value);
  const displayLabel = selected?.label ?? placeholder ?? "";
  const compact = size === "compact";

  useEffect(() => {
    if (!open) return;

    function placeMenu() {
      const root = rootRef.current;
      if (!root) return;
      const rect = root.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      // Prefer opening upward when the field is in the lower half of the screen.
      setMenuAbove(spaceBelow < 220 && spaceAbove > spaceBelow);
    }

    placeMenu();
    window.addEventListener("resize", placeMenu);
    return () => window.removeEventListener("resize", placeMenu);
  }, [open]);

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
      className={`relative ${
        open ? "z-[90]" : compact ? "z-[40]" : "z-30"
      } ${className}`.trim()}
    >
      <button
        type="button"
        disabled={disabled}
        className={
          buttonClassName ||
          (compact
            ? "flex h-8 w-full min-w-0 items-center gap-1.5 rounded-lg border border-input-border bg-transparent px-2 pr-1.5 text-left text-xs text-foreground disabled:opacity-50"
            : "mt-1 flex w-full min-w-0 items-center gap-2 rounded-xl border border-input-border bg-transparent py-2.5 pl-3 pr-3 text-left text-base text-foreground outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary/40 disabled:opacity-50")
        }
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={label}
        onClick={() => {
          if (disabled) return;
          setOpen((current) => !current);
        }}
      >
        {leadingIcon ? (
          <span
            aria-hidden
            className={`shrink-0 text-muted ${compact ? "[&_svg]:size-3.5" : "[&_svg]:size-4"}`}
          >
            {leadingIcon}
          </span>
        ) : null}
        <span
          className={`min-w-0 flex-1 truncate ${
            selected ? "text-foreground" : "text-muted"
          }`}
          title={displayLabel || undefined}
        >
          {displayLabel}
        </span>
        <span
          className={`shrink-0 text-muted transition-transform ${
            compact ? "text-[0.6rem]" : "text-[0.65rem]"
          } ${open ? "rotate-180" : ""}`}
          aria-hidden
        >
          ▼
        </span>
      </button>

      {open ? (
        <ul
          id={listId}
          role="listbox"
          aria-label={label}
          className={`absolute z-[100] max-h-72 min-w-full w-max max-w-[min(90vw,24rem)] overflow-y-auto overscroll-contain rounded-xl border border-input-border py-1 shadow-lg shadow-black/50 ${
            menuAbove ? "bottom-full mb-1" : "top-full mt-1"
          } ${menuAlign === "end" ? "right-0" : "left-0"}`}
          style={{ backgroundColor: "var(--background)" }}
        >
          {options.length === 0 ? (
            <li className="px-3 py-2.5 text-sm text-muted">{placeholder ?? label}</li>
          ) : (
            options.map((option) => {
              const active = option.value === value;
              return (
                <li key={option.value} role="presentation">
                  <button
                    type="button"
                    role="option"
                    aria-selected={active}
                    disabled={option.disabled}
                    title={option.label}
                    className={`flex w-full px-3 py-2.5 text-left text-sm whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-40 ${
                      active
                        ? "bg-selected text-primary"
                        : "text-foreground hover:bg-selected/40"
                    }`}
                    style={
                      active ? undefined : { backgroundColor: "var(--background)" }
                    }
                    onClick={() => {
                      if (option.disabled) return;
                      onChange(option.value);
                      setOpen(false);
                    }}
                  >
                    {option.label}
                  </button>
                </li>
              );
            })
          )}
        </ul>
      ) : null}
    </div>
  );
}

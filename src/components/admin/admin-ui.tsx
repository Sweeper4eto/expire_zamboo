"use client";

import type { ReactNode } from "react";
import { useState } from "react";

export type AdminNavId =
  | "accounts"
  | "household"
  | "payments"
  | "items"
  | "support"
  | "whatsNew"
  | "minimart"
  | "ocrUsage"
  | "audit";

export type AdminNavItem = {
  id: AdminNavId;
  label: string;
  /** Shown in desktop rail and mobile primary/more. */
  group: "primary" | "secondary";
  badge?: number;
};

export function AdminTabBar<T extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: { id: T; label: ReactNode }[];
  active: T;
  onChange: (id: T) => void;
}) {
  return (
    <div
      role="tablist"
      className="flex flex-wrap gap-1 border-b border-card-border"
    >
      {tabs.map((tab) => {
        const isActive = active === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.id)}
            className={`-mb-px rounded-t-lg px-3 py-2 text-xs font-medium transition-colors sm:px-4 sm:py-2.5 sm:text-sm ${
              isActive
                ? "relative z-10 border border-b-0 border-card-border bg-transparent text-primary"
                : "text-muted hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

export function AdminShell({
  brand,
  signedInAs,
  items,
  active,
  onChange,
  children,
}: {
  brand: ReactNode;
  signedInAs?: string;
  items: AdminNavItem[];
  active: AdminNavId;
  onChange: (id: AdminNavId) => void;
  children: ReactNode;
}) {
  const [moreOpen, setMoreOpen] = useState(false);
  const primary = items.filter((item) => item.group === "primary");
  const secondary = items.filter((item) => item.group === "secondary");
  const activeIsSecondary = secondary.some((item) => item.id === active);

  function NavButton({
    item,
    compact = false,
  }: {
    item: AdminNavItem;
    compact?: boolean;
  }) {
    const isActive = active === item.id;
    return (
      <button
        type="button"
        role="tab"
        aria-selected={isActive}
        onClick={() => {
          onChange(item.id);
          setMoreOpen(false);
        }}
        className={`flex items-center gap-2 rounded-xl text-left transition-colors ${
          compact
            ? "flex-col gap-0.5 px-1 py-1.5 text-[10px] font-semibold"
            : "w-full px-2.5 py-2 text-sm font-medium"
        } ${
          isActive
            ? "bg-selected text-primary"
            : "text-muted hover:bg-selected/40 hover:text-foreground"
        }`}
      >
        <span className={compact ? "leading-tight" : "min-w-0 flex-1 truncate"}>
          {item.label}
        </span>
        {item.badge && item.badge > 0 ? (
          <span
            className={`rounded-full bg-danger px-1.5 py-0.5 text-[10px] leading-none text-danger-fg ${
              compact ? "mt-0.5" : "ml-auto"
            }`}
          >
            {item.badge}
          </span>
        ) : null}
      </button>
    );
  }

  return (
    <div className="flex min-h-[calc(100dvh-6rem)] flex-col gap-4 lg:min-h-[calc(100dvh-7rem)] lg:flex-row lg:gap-0 lg:overflow-hidden lg:rounded-2xl lg:border lg:border-card-border">
      <aside className="hidden w-52 shrink-0 flex-col border-r border-card-border bg-background/40 p-3 lg:flex">
        <div className="mb-4 px-1.5 pt-1">{brand}</div>
        <nav role="tablist" aria-orientation="vertical" className="flex flex-1 flex-col gap-0.5">
          {primary.map((item) => (
            <NavButton key={item.id} item={item} />
          ))}
          <div className="my-2 border-t border-card-border" />
          {secondary.map((item) => (
            <NavButton key={item.id} item={item} />
          ))}
        </nav>
        {signedInAs ? (
          <p className="mt-3 px-2.5 text-[11px] text-muted">{signedInAs}</p>
        ) : null}
      </aside>

      <div className="min-w-0 flex-1 pb-[calc(4.25rem+env(safe-area-inset-bottom,0px))] lg:pb-0">
        <div className="min-w-0 p-4 sm:p-5 md:p-6">{children}</div>
      </div>

      <nav
        role="tablist"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-card-border bg-background/95 px-1 pb-[max(0.35rem,env(safe-area-inset-bottom,0px))] pt-1 backdrop-blur-sm lg:hidden"
      >
        <div className="mx-auto grid max-w-lg grid-cols-5 gap-0.5">
          {primary.slice(0, 4).map((item) => (
            <NavButton key={item.id} item={item} compact />
          ))}
          <button
            type="button"
            aria-expanded={moreOpen}
            onClick={() => setMoreOpen((open) => !open)}
            className={`flex flex-col items-center gap-0.5 rounded-xl px-1 py-1.5 text-[10px] font-semibold ${
              activeIsSecondary || moreOpen
                ? "bg-selected text-primary"
                : "text-muted"
            }`}
          >
            More
          </button>
        </div>
        {moreOpen ? (
          <div className="mx-auto mt-1 max-w-lg rounded-xl border border-card-border bg-background p-2 shadow-lg">
            {secondary.map((item) => (
              <NavButton key={item.id} item={item} />
            ))}
          </div>
        ) : null}
      </nav>
    </div>
  );
}

export function AdminPanel({ children }: { children: ReactNode }) {
  return (
    <div className="min-w-0 rounded-2xl border border-card-border bg-transparent shadow-sm lg:border-0 lg:shadow-none">
      {children}
    </div>
  );
}

export function AdminPanelBody({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`min-w-0 p-4 sm:p-5 md:p-6 ${className}`}>{children}</div>;
}

export function AdminSection({
  title,
  children,
  className = "",
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={className}>
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted">
        {title}
      </h2>
      {children}
    </section>
  );
}

export function AdminField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1.5 block font-medium text-foreground">{label}</span>
      {children}
    </label>
  );
}

export const adminInputClass =
  "w-full min-w-0 rounded-xl border border-input-border bg-input px-3 py-2.5 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20";

export const adminSearchInputClass = `${adminInputClass} min-w-0 flex-1`;

export const adminButtonRowClass = "grid grid-cols-1 gap-2 sm:grid-cols-2";

export const adminDangerButtonClass =
  "w-full rounded-xl border border-danger-border px-4 py-3 text-base font-medium text-error disabled:opacity-50";

export const adminPaginationClass =
  "flex flex-wrap items-center justify-between gap-3 border-t border-card-border pt-4";

export function AdminEmptyState({ message }: { message: ReactNode }) {
  return (
    <div className="flex min-h-[10rem] items-center justify-center rounded-xl border border-dashed border-input-border bg-background px-6 py-8 text-center">
      {typeof message === "string" ? (
        <p className="max-w-sm text-sm text-muted">{message}</p>
      ) : (
        message
      )}
    </div>
  );
}

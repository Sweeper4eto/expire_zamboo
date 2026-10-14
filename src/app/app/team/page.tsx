"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CancelButton } from "@/components/cancel-button";
import { LoadingSpinner, LoadingSpinnerBlock } from "@/components/loading-spinner";
import { MobilePageHeader } from "@/components/mobile-page-header";
import { TrashIcon } from "@/components/app-nav-icons";
import { useT } from "@/components/i18n-provider";
import { useViewportInsets } from "@/hooks/use-viewport-insets";
import {
  appButtonDangerFull,
  appButtonNeutral,
  appButtonPrimary,
  appButtonPrimaryFull,
  appChromeInset,
  appFooterButtonGrid,
  appListInset,
  appPageShell,
} from "@/lib/app-ui";
import {
  formatDurationMinutes,
  type ScheduleAccess,
} from "@/lib/schedule";

type Store = { id: string; name: string; active: boolean };
type TeamUser = {
  id: string;
  username: string;
  displayName?: string | null;
  email: string | null;
  active: boolean;
  clientRole: "OWNER" | "MEMBER" | null;
  stores: Store[];
  /** Scheduled minutes from the 1st of this month through yesterday. */
  hoursThisMonthMin?: number;
};

type SheetMode = "create" | "edit";

function initials(username: string): string {
  const parts = username.trim().split(/[\s._-]+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
  }
  return username.slice(0, 2).toUpperCase() || "?";
}

function EyeIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M3 3l18 18" strokeLinecap="round" />
      <path d="M10.6 10.6A3 3 0 0 0 12 15a3 3 0 0 0 2.4-1.2" strokeLinecap="round" />
      <path d="M9.9 5.2A11 11 0 0 1 12 5c6.5 0 10 7 10 7a18 18 0 0 1-4.2 4.8M6.1 6.1A18 18 0 0 0 2 12s3.5 7 10 7a11 11 0 0 0 4-.7" strokeLinecap="round" />
    </svg>
  );
}

function OwnerRoleIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M3 8l4 3 5-6 5 6 4-3v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8Z" strokeLinejoin="round" />
      <path d="M8 19h8" strokeLinecap="round" />
    </svg>
  );
}

function StaffRoleIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <circle cx="12" cy="8" r="3.25" />
      <path d="M5.5 19a6.5 6.5 0 0 1 13 0" strokeLinecap="round" />
    </svg>
  );
}

function ChevronIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ScheduleAccessControl({
  value,
  disabled,
  onChange,
  labels,
  ariaLabel,
}: {
  value: ScheduleAccess;
  disabled?: boolean;
  onChange: (next: ScheduleAccess) => void;
  labels: { disabled: string; private: string; public: string };
  ariaLabel: string;
}) {
  const order = ["disabled", "private", "public"] as const;

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="inline-flex shrink-0 rounded-lg border border-card-border p-0.5"
    >
      {order.map((mode) => {
        const active = mode === value;
        return (
          <button
            key={mode}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled}
            onClick={() => onChange(mode)}
            className={`rounded-md px-2 py-1 text-[0.65rem] font-semibold transition-colors ${
              active
                ? "bg-selected text-primary"
                : "bg-transparent text-muted hover:text-foreground"
            }`}
          >
            {labels[mode]}
          </button>
        );
      })}
    </div>
  );
}

function ScheduleIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      aria-hidden
    >
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18" strokeLinecap="round" />
      <path d="M8 3v4" strokeLinecap="round" />
      <path d="M16 3v4" strokeLinecap="round" />
      <path d="M8 14h3" strokeLinecap="round" />
      <path d="M14 14h2" strokeLinecap="round" />
    </svg>
  );
}

function PasswordField({
  label,
  value,
  onChange,
  placeholder,
  show,
  onToggleShow,
  showLabel,
  hideLabel,
  error,
  errorId,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  show: boolean;
  onToggleShow: () => void;
  showLabel: string;
  hideLabel: string;
  error?: string;
  errorId?: string;
}) {
  return (
    <label className="block text-sm font-medium text-foreground">
      {label}
      <span className="relative mt-0.5 block">
        <input
          type={show ? "text" : "password"}
          className={`w-full rounded-xl border bg-input px-3 py-2 pr-11 text-base text-foreground ${
            error
              ? "border-error focus:border-error focus:ring-1 focus:ring-error/40"
              : "border-input-border outline-none focus:border-primary focus:ring-1 focus:ring-primary/40"
          }`}
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
          autoComplete="new-password"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
        />
        <button
          type="button"
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-muted hover:text-foreground"
          aria-label={show ? hideLabel : showLabel}
          onClick={onToggleShow}
        >
          {show ? <EyeIcon /> : <EyeOffIcon />}
        </button>
      </span>
      {error ? (
        <p id={errorId} className="mt-0.5 text-xs text-error">
          {error}
        </p>
      ) : null}
    </label>
  );
}

export default function TeamPage() {
  const { t } = useT();
  const { offsetTop, keyboardInset, height: viewportHeight } = useViewportInsets();
  const usernameRef = useRef<HTMLInputElement>(null);

  const [users, setUsers] = useState<TeamUser[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [currentUserId, setCurrentUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetMode, setSheetMode] = useState<SheetMode>("create");
  const [editingUserId, setEditingUserId] = useState<string | null>(null);

  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState<"OWNER" | "MEMBER">("MEMBER");
  const [storeIds, setStoreIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<TeamUser | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [editingHoursMin, setEditingHoursMin] = useState(0);
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduleAccess, setScheduleAccess] =
    useState<ScheduleAccess>("private");
  const [scheduleSaving, setScheduleSaving] = useState(false);

  const activeStores = useMemo(
    () => stores.filter((store) => store.active),
    [stores],
  );

  const allStoresSelected =
    activeStores.length > 0 && storeIds.length >= activeStores.length;

  const passwordError = useMemo(() => {
    if (!password) return "";
    if (password.length < 6) return t("auth.passwordTooShort");
    return "";
  }, [password, t]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [meResponse, response, accessRes] = await Promise.all([
        fetch("/api/auth/me"),
        fetch("/api/team/users"),
        fetch("/api/team/schedule-access"),
      ]);
      const meData = await meResponse.json().catch(() => null);
      if (meData?.user?.id) setCurrentUserId(meData.user.id);

      const data = await response.json().catch(() => null);
      if (!response.ok) {
        if (response.status === 401) {
          setError(data?.error ?? t("errors.unauthorized"));
        } else {
          setError(data?.error ?? t("errors.forbidden"));
        }
        setUsers([]);
        setStores([]);
        setScheduleEnabled(false);
        return;
      }
      setUsers(data.users ?? []);
      setStores(data.stores ?? []);

      const accessData = await accessRes.json().catch(() => null);
      if (accessRes.ok) {
        setScheduleEnabled(Boolean(accessData?.scheduleEnabled));
        if (accessData?.scheduleAccess) {
          setScheduleAccess(accessData.scheduleAccess as ScheduleAccess);
        }
      } else {
        setScheduleEnabled(false);
      }
    } catch {
      setError(t("team.loadFailed"));
      setUsers([]);
      setStores([]);
      setScheduleEnabled(false);
    } finally {
      setLoading(false);
    }
  }, [t]);

  async function setScheduleAccessMode(next: ScheduleAccess) {
    if (next === scheduleAccess || scheduleSaving) return;
    setScheduleSaving(true);
    setError("");
    try {
      const response = await fetch("/api/team/schedule-access", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduleAccess: next }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setError(data?.error ?? t("team.scheduleAccessFailed"));
        return;
      }
      setScheduleAccess(
        (data?.scheduleAccess as ScheduleAccess) ?? next,
      );
    } catch {
      setError(t("team.scheduleAccessFailed"));
    } finally {
      setScheduleSaving(false);
    }
  }

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!sheetOpen) return;
    const timer = window.setTimeout(() => usernameRef.current?.focus(), 50);
    return () => window.clearTimeout(timer);
  }, [sheetOpen, sheetMode]);

  function hasAllStores(userStores: Store[]): boolean {
    return activeStores.length > 0 && userStores.length >= activeStores.length;
  }

  function resetForm(defaults?: { storeIds?: string[] }) {
    setDisplayName("");
    setUsername("");
    setPassword("");
    setShowPassword(false);
    setRole("MEMBER");
    setStoreIds(
      defaults?.storeIds?.length
        ? defaults.storeIds
        : activeStores[0]
          ? [activeStores[0].id]
          : [],
    );
    setEditingUserId(null);
  }

  function openCreate() {
    setSheetMode("create");
    resetForm();
    setError("");
    setMessage("");
    setSheetOpen(true);
  }

  function openEdit(user: TeamUser) {
    setSheetMode("edit");
    setEditingUserId(user.id);
    setDisplayName(user.displayName ?? "");
    setUsername(user.username);
    setPassword("");
    setShowPassword(false);
    setRole(user.clientRole === "OWNER" ? "OWNER" : "MEMBER");
    setStoreIds(user.stores.map((store) => store.id));
    setEditingHoursMin(0);
    setError("");
    setMessage("");
    setSheetOpen(true);
    void fetch(
      `/api/team/users/hours?userId=${encodeURIComponent(user.id)}`,
    )
      .then((res) => res.json().then((body) => ({ ok: res.ok, body })))
      .then(({ ok, body }) => {
        if (!ok) return;
        const minutes = Number(body?.hoursThisMonthMin);
        if (Number.isFinite(minutes)) setEditingHoursMin(minutes);
      })
      .catch(() => {
        /* keep 0 */
      });
  }

  function closeSheet() {
    if (saving) return;
    setSheetOpen(false);
    resetForm();
  }

  function toggleStore(id: string) {
    setStoreIds((current) =>
      current.includes(id)
        ? current.filter((storeId) => storeId !== id)
        : [...current, id],
    );
  }

  function toggleAllStores() {
    if (allStoresSelected) {
      setStoreIds([]);
      return;
    }
    setStoreIds(activeStores.map((store) => store.id));
  }

  function formValid(): boolean {
    if (username.trim().length < 3) return false;
    if (passwordError) return false;
    if (storeIds.length === 0) return false;
    if (sheetMode === "create") return password.length >= 6;
    if (password) return password.length >= 6;
    return true;
  }

  async function submitCreate() {
    setSaving(true);
    setError("");
    setMessage("");
    const response = await fetch("/api/team/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username,
        displayName: displayName.trim() || null,
        password,
        storeIds,
        clientRole: role,
      }),
    });
    const data = await response.json().catch(() => null);
    setSaving(false);
    if (!response.ok) {
      setError(data?.error ?? t("team.createFailed"));
      return;
    }
    setMessage(t("team.created"));
    setSheetOpen(false);
    resetForm();
    await load();
  }

  async function submitEdit() {
    if (!editingUserId) return;
    setSaving(true);
    setError("");
    setMessage("");
    const response = await fetch("/api/team/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: editingUserId,
        username,
        displayName: displayName.trim() || null,
        storeIds,
        clientRole: role,
        ...(password ? { password, confirmPassword: password } : {}),
      }),
    });
    const data = await response.json().catch(() => null);
    setSaving(false);
    if (!response.ok) {
      setError(data?.error ?? t("team.saveFailed"));
      return;
    }
    setMessage(t("team.updated"));
    setSheetOpen(false);
    resetForm();
    await load();
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    setError("");
    setMessage("");
    const response = await fetch("/api/team/users", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: deleteTarget.id }),
    });
    const data = await response.json().catch(() => null);
    setDeleting(false);
    if (!response.ok) {
      setError(data?.error ?? t("team.deleteFailed"));
      setDeleteTarget(null);
      return;
    }
    setMessage(t("team.deleted"));
    if (editingUserId === deleteTarget.id) {
      setSheetOpen(false);
      resetForm();
    }
    setDeleteTarget(null);
    await load();
  }

  function submitSheet() {
    if (!formValid()) return;
    if (sheetMode === "edit") {
      void submitEdit();
      return;
    }
    void submitCreate();
  }

  const editingUser = editingUserId
    ? users.find((user) => user.id === editingUserId) ?? null
    : null;
  const canDeleteEditing =
    sheetMode === "edit" &&
    editingUser &&
    editingUser.id !== currentUserId;

  return (
    <div className={`relative ${appPageShell} overflow-x-visible ${appChromeInset} pb-24 pt-1`}>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[radial-gradient(ellipse_at_70%_0%,rgb(52_211_153/0.14),transparent_55%)]"
      />

      <div className="relative z-40">
        <MobilePageHeader className="mb-3" />
      </div>

      <div className={`relative z-0 mb-4 ${appListInset}`}>
        <h1 className="text-2xl font-semibold leading-tight tracking-tight text-foreground">
          {t("team.title")}
        </h1>
        <p className="mt-1 text-sm leading-snug text-muted">{t("team.subtitle")}</p>
      </div>

      {scheduleEnabled ? (
      <div className={`relative z-0 mb-4 ${appListInset}`}>
        <div className="flex items-center justify-between gap-2">
          <p className="shrink-0 text-sm font-semibold text-foreground">
            {t("app.schedule")}
          </p>
          <ScheduleAccessControl
            value={scheduleAccess}
            disabled={scheduleSaving}
            onChange={(next) => void setScheduleAccessMode(next)}
            ariaLabel={t("app.schedule")}
            labels={{
              disabled: t("team.scheduleDisabled"),
              private: t("team.schedulePrivate"),
              public: t("team.schedulePublic"),
            }}
          />
        </div>
        <p className="mt-1 truncate text-xs leading-snug text-muted whitespace-nowrap">
          {scheduleAccess === "disabled"
            ? t("team.scheduleDisabledHint")
            : scheduleAccess === "private"
              ? t("team.schedulePrivateHint")
              : t("team.schedulePublicHint")}
        </p>
        {scheduleAccess !== "disabled" ? (
          <Link
            href="/app/schedule"
            className="mt-2 flex items-center gap-2.5 rounded-xl border border-card-border px-2.5 py-2 transition-colors hover:border-primary/45"
          >
            <span
              aria-hidden
              className="flex size-8 shrink-0 items-center justify-center rounded-full border border-primary/45 text-primary"
            >
              <ScheduleIcon className="size-4" />
            </span>
            <span className="min-w-0 flex-1 text-sm font-semibold text-foreground">
              {t("team.openSchedule")}
            </span>
            <ChevronIcon className="size-3.5 shrink-0 text-primary" />
          </Link>
        ) : null}
      </div>
      ) : null}

      {loading ? (
        <LoadingSpinnerBlock wrapperClassName="mb-3 flex justify-center py-2" />
      ) : null}
      {error && !sheetOpen ? <p className={`mb-3 text-sm text-error ${appListInset}`}>{error}</p> : null}
      {message && !sheetOpen ? (
        <p className={`mb-3 text-sm text-success-fg ${appListInset}`}>{message}</p>
      ) : null}

      <section className={`relative z-0 mb-4 ${appListInset}`}>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
          {t("team.people")}
        </p>

        {!loading && users.length === 0 ? (
          <p className="rounded-2xl border border-card-border px-3 py-4 text-sm text-muted">
            {t("team.empty")}
          </p>
        ) : null}

        {!loading && users.length === 1 && users[0]?.id === currentUserId ? (
          <p className="mb-2 text-sm text-muted">{t("team.aloneHint")}</p>
        ) : null}

        <ul className="space-y-2">
          {users.map((user) => {
            const isSelf = user.id === currentUserId;
            const isOwner = user.clientRole === "OWNER";
            const interactive = !isSelf;

            const cardInner = (
              <>
                <span
                  aria-hidden
                  className="flex size-8 shrink-0 items-center justify-center rounded-full border border-primary/45 bg-selected text-[0.65rem] font-semibold text-primary"
                >
                  {initials(user.displayName?.trim() || user.username)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {user.displayName?.trim() || user.username}
                    {isSelf ? (
                      <span className="ml-1.5 text-xs font-normal text-muted">
                        ({t("team.you")})
                      </span>
                    ) : null}
                    {!user.active ? (
                      <span className="ml-1.5 rounded-md border border-card-border px-1.5 py-0.5 text-[0.65rem] font-normal text-muted">
                        {t("team.inactive")}
                      </span>
                    ) : null}
                  </p>
                  {user.displayName?.trim() ? (
                    <p className="truncate text-xs text-muted">{user.username}</p>
                  ) : null}
                  <div className="mt-0.5 flex min-w-0 flex-wrap gap-1">
                    {hasAllStores(user.stores) ? (
                      <span className="rounded-md border border-primary/40 px-1.5 py-0.5 text-[0.65rem] font-medium text-primary">
                        {t("team.allStores")}
                      </span>
                    ) : user.stores.length === 0 ? (
                      <span className="text-xs text-muted">—</span>
                    ) : (
                      user.stores.slice(0, 3).map((store) => (
                        <span
                          key={store.id}
                          className="rounded-md border border-primary/35 px-1.5 py-0.5 text-[0.65rem] font-medium text-primary"
                        >
                          {store.name}
                        </span>
                      ))
                    )}
                    {!hasAllStores(user.stores) && user.stores.length > 3 ? (
                      <span className="rounded-md border border-card-border px-1.5 py-0.5 text-[0.65rem] text-muted">
                        +{user.stores.length - 3}
                      </span>
                    ) : null}
                  </div>
                </div>
                <span
                  className={`inline-flex shrink-0 items-center gap-1 text-xs font-medium ${
                    isOwner ? "text-primary" : "text-muted"
                  }`}
                >
                  {isOwner ? (
                    <OwnerRoleIcon className="size-3.5" />
                  ) : (
                    <StaffRoleIcon className="size-3.5" />
                  )}
                  {isOwner ? t("team.owner") : t("team.member")}
                </span>
                {interactive ? (
                  <ChevronIcon className="size-3.5 shrink-0 text-primary" />
                ) : null}
              </>
            );

            const cardClassName =
              "flex w-full items-center gap-2.5 rounded-xl border border-card-border px-2.5 py-2 text-left";

            return (
              <li key={user.id} className={user.active ? "" : "opacity-60"}>
                {interactive ? (
                  <button
                    type="button"
                    onClick={() => openEdit(user)}
                    className={`${cardClassName} bg-transparent transition-colors hover:border-primary/45`}
                  >
                    {cardInner}
                  </button>
                ) : (
                  <div className={cardClassName}>{cardInner}</div>
                )}
              </li>
            );
          })}
        </ul>

        {!loading && users.some((user) => user.id !== currentUserId) ? (
          <p className="mt-3 text-center text-xs text-muted">{t("team.tapToEdit")}</p>
        ) : null}
      </section>

      {!sheetOpen ? (
        <div
          className="fixed inset-x-0 z-40 border-t border-card-border/60 bg-background/95 px-4 py-2 backdrop-blur-sm"
          style={{
            bottom:
              "calc(var(--app-bottom-nav-height) + env(safe-area-inset-bottom, 0px))",
          }}
        >
          <div className={`mx-auto max-w-lg ${appListInset}`}>
            <button type="button" onClick={openCreate} className={appButtonPrimaryFull}>
              {t("team.addMember")}
            </button>
          </div>
        </div>
      ) : null}

      {sheetOpen ? (
        <div
          className="fixed inset-x-0 z-[60] flex flex-col justify-end overflow-hidden overscroll-none bg-black/65"
          style={
            viewportHeight > 0
              ? { top: offsetTop, height: viewportHeight }
              : { top: offsetTop, bottom: keyboardInset }
          }
          role="dialog"
          aria-modal="true"
          aria-label={
            sheetMode === "create" ? t("team.newUser") : t("team.editUser")
          }
          onClick={closeSheet}
        >
          <div
            className="flex max-h-full min-h-0 w-full flex-col rounded-t-3xl border border-card-border bg-background shadow-[0_-12px_40px_rgba(0,0,0,0.35)]"
            style={{
              maxHeight:
                viewportHeight > 0
                  ? `min(40rem, ${viewportHeight}px)`
                  : "min(40rem, 100%)",
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex shrink-0 justify-center pt-2.5" aria-hidden>
              <span className="h-1 w-10 rounded-full bg-card-border" />
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-4 pb-2 pt-2">
              {error ? <p className="mb-2 text-sm text-error">{error}</p> : null}

              <div className="space-y-2">
                <label className="block text-sm font-medium text-foreground">
                  {t("team.displayName")}
                  <input
                    className="mt-0.5 w-full rounded-xl border border-input-border bg-input px-3 py-2 text-base text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary/40"
                    value={displayName}
                    placeholder={t("team.displayNamePlaceholder")}
                    onChange={(event) => setDisplayName(event.target.value)}
                    autoComplete="name"
                    maxLength={80}
                  />
                  <p className="mt-0.5 text-xs text-muted">{t("team.displayNameHint")}</p>
                </label>
                <label className="block text-sm font-medium text-foreground">
                  {t("team.username")}
                  <input
                    ref={usernameRef}
                    className="mt-0.5 w-full rounded-xl border border-input-border bg-input px-3 py-2 text-base text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary/40"
                    value={username}
                    placeholder={t("team.usernamePlaceholder")}
                    onChange={(event) => setUsername(event.target.value)}
                    autoComplete="off"
                  />
                </label>
                <div>
                  <PasswordField
                    label={
                      sheetMode === "edit" ? t("team.newPassword") : t("team.password")
                    }
                    value={password}
                    onChange={setPassword}
                    placeholder={
                      sheetMode === "edit"
                        ? t("team.newPasswordPlaceholder")
                        : t("team.passwordPlaceholder")
                    }
                    show={showPassword}
                    onToggleShow={() => setShowPassword((current) => !current)}
                    showLabel={t("team.showPassword")}
                    hideLabel={t("team.hidePassword")}
                    error={passwordError}
                    errorId="team-password-error"
                  />
                  {sheetMode === "edit" && !passwordError ? (
                    <p className="mt-0.5 text-xs text-muted">{t("team.newPasswordHint")}</p>
                  ) : null}
                </div>
              </div>

              <div className="mt-2.5">
                <p className="mb-1 text-sm font-medium text-foreground">{t("team.role")}</p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setRole("OWNER")}
                    className={`inline-flex items-center justify-center gap-1.5 rounded-xl border px-2 py-2 text-sm font-semibold transition-colors ${
                      role === "OWNER"
                        ? "border-primary bg-selected/50 text-primary"
                        : "border-card-border text-foreground"
                    }`}
                  >
                    <OwnerRoleIcon className="size-4 shrink-0" />
                    {t("team.owner")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setRole("MEMBER")}
                    className={`inline-flex items-center justify-center gap-1.5 rounded-xl border px-2 py-2 text-sm font-semibold transition-colors ${
                      role === "MEMBER"
                        ? "border-primary bg-selected/50 text-primary"
                        : "border-card-border text-foreground"
                    }`}
                  >
                    <StaffRoleIcon className="size-4 shrink-0" />
                    {t("team.member")}
                  </button>
                </div>
              </div>

              <div className="mt-2.5">
                <p className="mb-1 text-sm font-medium text-foreground">{t("team.stores")}</p>
                <div className="max-h-40 space-y-0.5 overflow-y-auto rounded-xl border border-card-border p-1.5">
                  <label className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-semibold text-foreground hover:bg-selected/40">
                    <input
                      type="checkbox"
                      checked={allStoresSelected}
                      onChange={toggleAllStores}
                      className="size-3.5 accent-[var(--primary)]"
                    />
                    {t("team.allStores")}
                  </label>
                  <div className="border-t border-card-border" />
                  {activeStores.map((store) => (
                    <label
                      key={store.id}
                      className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-foreground hover:bg-selected/40"
                    >
                      <input
                        type="checkbox"
                        checked={storeIds.includes(store.id)}
                        onChange={() => toggleStore(store.id)}
                        className="size-3.5 accent-[var(--primary)]"
                      />
                      {store.name}
                    </label>
                  ))}
                  {activeStores.length === 0 ? (
                    <p className="px-2 py-1.5 text-xs text-muted">{t("support.noStores")}</p>
                  ) : null}
                </div>

                {sheetMode === "edit" ? (
                  <div className="mt-2.5">
                    <p className="text-sm font-medium text-foreground">
                      {t("team.hoursThisMonth")}
                    </p>
                    <p className="mt-0.5 rounded-xl border border-card-border px-3 py-2 text-sm tabular-nums text-foreground">
                      {formatDurationMinutes(
                        editingHoursMin,
                        t("schedule.hoursShort"),
                        t("schedule.minutesShort"),
                      )}
                    </p>
                    <p className="mt-0.5 text-xs text-muted">
                      {t("team.hoursThisMonthHint")}
                    </p>
                  </div>
                ) : null}

                {canDeleteEditing ? (
                  <button
                    type="button"
                    className={`${appButtonDangerFull} mt-2.5 gap-1.5`}
                    onClick={() => {
                      if (editingUser) setDeleteTarget(editingUser);
                    }}
                  >
                    <TrashIcon className="size-4 shrink-0" />
                    {t("team.deleteUser")}
                  </button>
                ) : null}
              </div>
            </div>

            <div className={`shrink-0 border-t border-card-border px-4 py-2.5 ${appFooterButtonGrid}`}>
              <button
                type="button"
                onClick={closeSheet}
                disabled={saving}
                className={appButtonNeutral}
              >
                {t("common.cancel")}
              </button>
              <button
                type="button"
                onClick={submitSheet}
                disabled={saving || !formValid()}
                className={appButtonPrimary}
              >
                {saving ? (
                  <LoadingSpinner size="sm" className="mx-auto" />
                ) : sheetMode === "edit" ? (
                  t("team.saveChanges")
                ) : (
                  t("common.create")
                )}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {deleteTarget ? (
        <div
          className="fixed inset-0 z-[70] flex items-end justify-center bg-black/65 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="team-delete-title"
          onClick={() => (!deleting ? setDeleteTarget(null) : undefined)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-card-border bg-background p-4 shadow-[0_20px_50px_rgba(0,0,0,0.45)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-3 flex size-11 items-center justify-center rounded-full border border-danger/40 bg-danger/10 text-danger">
              <TrashIcon className="size-5" />
            </div>
            <h2
              id="team-delete-title"
              className="text-lg font-semibold text-foreground"
            >
              {t("team.confirmDeleteTitle")}
            </h2>
            <p className="mt-1.5 text-sm leading-relaxed text-muted">
              {t("team.confirmDeleteMessage", { username: deleteTarget.username })}
            </p>
            <div className="mt-4 flex flex-col gap-2">
              <button
                type="button"
                disabled={deleting}
                onClick={() => void confirmDelete()}
                className={`${appButtonDangerFull} gap-1.5`}
              >
                {deleting ? (
                  <LoadingSpinner size="sm" className="mx-auto" />
                ) : (
                  <>
                    <TrashIcon className="size-4 shrink-0" />
                    {t("team.confirmDelete")}
                  </>
                )}
              </button>
              <CancelButton disabled={deleting} onClick={() => setDeleteTarget(null)}>
                {t("common.cancel")}
              </CancelButton>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

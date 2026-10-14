"use client";

import { appButtonNeutralFull, appButtonPrimaryFull } from "@/lib/app-ui";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LoadingSpinner } from "@/components/loading-spinner";
import { LoginIcon } from "@/components/app-nav-icons";
import { FormEvent, memo, useEffect, useState, type ChangeEvent, type ReactNode } from "react";
import { BrandName } from "@/components/brand-name";
import { LanguageSwitch } from "@/components/language-switch";
import { markPwaInstallOffered, shouldOfferPwaInstall } from "@/lib/pwa-install";
import {
  ORG_NAME_MAX,
  PASSWORD_MAX,
  USERNAME_MAX,
  passwordsMatch,
  validateOptionalEmail,
  validateOptionalOrgName,
  validatePassword,
  validateUsername,
} from "@/lib/register-validation";
import { useT } from "@/components/i18n-provider";

function UserFieldIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" strokeLinecap="round" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function LockFieldIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" strokeLinecap="round" />
    </svg>
  );
}

function MailFieldIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function OrgFieldIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M3 21h18" strokeLinecap="round" />
      <path d="M5 21V8l7-4 7 4v13" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9 21v-6h6v6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function HomeTypeIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z" strokeLinejoin="round" />
    </svg>
  );
}

function StoreTypeIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M4 9 5.5 4h13L20 9" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 9h16v11a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V9Z" strokeLinejoin="round" />
      <path d="M9 20v-6h6v6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function UserPlusIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" strokeLinecap="round" />
      <circle cx="9" cy="7" r="4" />
      <path d="M19 8v6" strokeLinecap="round" />
      <path d="M22 11h-6" strokeLinecap="round" />
    </svg>
  );
}

function AccountTypeSwitch({
  value,
  onChange,
  homeLabel,
  retailLabel,
  groupLabel,
}: {
  value: "home" | "retail";
  onChange: (value: "home" | "retail") => void;
  homeLabel: string;
  retailLabel: string;
  groupLabel: string;
}) {
  const options = [
    { value: "retail" as const, label: retailLabel, Icon: StoreTypeIcon },
    { value: "home" as const, label: homeLabel, Icon: HomeTypeIcon },
  ];

  return (
    <div
      role="radiogroup"
      aria-label={groupLabel}
      className="grid grid-cols-2 gap-1.5 rounded-xl border border-white/15 bg-transparent p-1"
    >
      {options.map((option) => {
        const selected = option.value === value;
        const Icon = option.Icon;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={`inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-sm font-medium transition-colors ${
              selected
                ? "bg-primary text-primary-fg shadow-sm"
                : "text-muted hover:bg-white/5 hover:text-foreground"
            }`}
          >
            <Icon className="size-4 shrink-0" />
            <span className="truncate">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function EyeIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M3 3l18 18" strokeLinecap="round" />
      <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" strokeLinecap="round" />
      <path d="M9.9 5.1A10.5 10.5 0 0 1 12 5c6.5 0 10 7 10 7a17.4 17.4 0 0 1-2.2 3.2" strokeLinecap="round" />
      <path d="M6.1 6.1A17.5 17.5 0 0 0 2 12s3.5 7 10 7a10.4 10.4 0 0 0 4.2-.9" strokeLinecap="round" />
    </svg>
  );
}

export function AuthShell({
  title,
  subtitle,
  children,
  showLanguageSwitch = false,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  showLanguageSwitch?: boolean;
}) {
  const { t } = useT();

  return (
    <div className="mx-auto flex min-h-svh w-full min-w-0 max-w-md flex-col justify-center px-4 pb-6 pt-[max(1.5rem,env(safe-area-inset-top,0px))]">
      <div className="relative rounded-2xl border border-card-border bg-transparent p-5 pt-12 shadow-[0_0_40px_rgb(16_185_129/0.08)]">
        {showLanguageSwitch ? (
          <div className="absolute right-4 top-4 z-40">
            <LanguageSwitch />
          </div>
        ) : null}

        <div className="mb-5 flex justify-center">
          <Link
            href="/"
            aria-label={t("common.home")}
            className="inline-flex flex-col items-center gap-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/landing/brand-mark.png?v=3"
              alt=""
              width={96}
              height={96}
              className="box-border h-24 w-24 object-contain"
              decoding="async"
            />
            <BrandName className="text-[1.65rem] leading-none" />
          </Link>
        </div>
        <h1 className="text-center text-base font-medium text-foreground">{title}</h1>
        {subtitle ? <p className="mt-2 text-center text-sm text-muted">{subtitle}</p> : null}
        <div className="mt-5">{children}</div>
      </div>
    </div>
  );
}

export function TextField({
  label,
  name,
  type = "text",
  value,
  onChange,
  autoComplete,
  hint,
  error,
}: {
  label: string;
  name?: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete?: string;
  hint?: string;
  error?: string;
}) {
  return (
    <label className="block text-sm font-medium text-foreground">
      {label}
      <input
        className={`mt-1 w-full rounded-xl border bg-transparent px-2.5 py-2 text-base text-foreground outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary/40 ${
          error ? "border-error" : "border-white/15"
        }`}
        name={name}
        type={type}
        value={value}
        autoComplete={autoComplete}
        aria-invalid={error ? true : undefined}
        onChange={(event) => onChange(event.target.value)}
        onInput={(event) => onChange(event.currentTarget.value)}
      />
      {error ? (
        <span className="mt-1 block text-[0.7rem] font-normal leading-snug text-error">
          {error}
        </span>
      ) : hint ? (
        <span className="mt-1 block text-[0.7rem] font-normal leading-snug text-muted">
          {hint}
        </span>
      ) : null}
    </label>
  );
}

function AuthIconField({
  label,
  name,
  inputId,
  type = "text",
  value,
  defaultValue,
  onChange,
  autoComplete,
  icon,
  trailing,
  compact = false,
  hint,
  error,
  maxLength,
  required,
}: {
  label: string;
  name?: string;
  inputId?: string;
  type?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  autoComplete?: string;
  icon: ReactNode;
  trailing?: ReactNode;
  compact?: boolean;
  hint?: string;
  error?: string;
  maxLength?: number;
  required?: boolean;
}) {
  const describedBy = error ? `${name}-error` : hint ? `${name}-hint` : undefined;
  const resolvedId = inputId ?? (name ? `auth-field-${name}` : undefined);
  const controlled = value !== undefined;

  return (
    <div className={hint || error ? "space-y-1.5 pb-2" : ""}>
      <div className="relative">
        {resolvedId ? (
          <label htmlFor={resolvedId} className="sr-only">
            {label}
          </label>
        ) : (
          <span className="sr-only">{label}</span>
        )}
        <span
          className={`pointer-events-none absolute left-3 top-1/2 z-[1] -translate-y-1/2 text-muted ${
            compact ? "[&_svg]:size-4" : ""
          }`}
        >
          {icon}
        </span>
        <input
          id={resolvedId}
          className={`w-full rounded-xl border bg-transparent text-foreground outline-none transition-colors placeholder:text-muted focus:border-primary focus:ring-1 focus:ring-primary/40 ${
            compact ? "py-2 text-[0.95rem]" : "py-3 text-base"
          } ${trailing ? "pl-10 pr-11" : "px-10"} ${
            error ? "border-error" : "border-white/15"
          }`}
          name={name}
          type={type}
          placeholder={label}
          autoComplete={autoComplete}
          maxLength={maxLength}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          {...(controlled
            ? {
                value,
                onChange: (event: ChangeEvent<HTMLInputElement>) =>
                  onChange?.(event.target.value),
                onInput: (event: FormEvent<HTMLInputElement>) =>
                  onChange?.(event.currentTarget.value),
              }
            : { defaultValue: defaultValue ?? "" })}
        />
        {trailing ? (
          <div className="absolute right-1 top-1/2 z-[1] -translate-y-1/2">
            {trailing}
          </div>
        ) : null}
      </div>
      {error ? (
        <p id={`${name}-error`} className="px-0.5 text-[0.75rem] leading-snug text-error">
          {error}
        </p>
      ) : hint ? (
        <p
          id={`${name}-hint`}
          className="px-0.5 text-[0.75rem] leading-snug text-zinc-400"
        >
          {hint}
        </p>
      ) : null}
    </div>
  );
}

function passwordStrengthScore(password: string): number {
  if (!password) return 0;
  let score = 0;
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;
  return Math.min(4, score);
}

function PasswordStrengthBar({ password }: { password: string }) {
  const { t } = useT();
  const score = passwordStrengthScore(password);
  const labels = [
    t("auth.passwordStrengthWeak"),
    t("auth.passwordStrengthFair"),
    t("auth.passwordStrengthGood"),
    t("auth.passwordStrengthStrong"),
  ];
  const colors = [
    "bg-error",
    "bg-warning-fg",
    "bg-primary/70",
    "bg-primary",
  ];

  return (
    <div className="-mt-1 space-y-1.5" aria-live="polite">
      <div className="grid grid-cols-4 gap-1">
        {Array.from({ length: 4 }, (_, index) => (
          <span
            key={index}
            className={`h-1 rounded-full ${
              index < score ? colors[score - 1] : "bg-white/15"
            }`}
          />
        ))}
      </div>
      {password ? (
        <p className="text-[0.7rem] leading-none text-zinc-400">
          {t("auth.passwordStrength")}: {labels[Math.max(0, score - 1)]}
        </p>
      ) : null}
    </div>
  );
}

export function PrimaryButton({
  children,
  disabled,
  type = "button",
  onClick,
  className = "",
  icon,
  "aria-busy": ariaBusy,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  type?: "button" | "submit";
  onClick?: () => void;
  className?: string;
  icon?: React.ReactNode;
  "aria-busy"?: boolean;
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      aria-busy={ariaBusy}
      onClick={onClick}
      className={`${appButtonPrimaryFull} ${className}`.trim()}
    >
      {icon}
      {children}
    </button>
  );
}

export function SecondaryButton({
  children,
  onClick,
  type = "button",
  disabled = false,
  icon,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  disabled?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={appButtonNeutralFull}
    >
      {icon}
      {children}
    </button>
  );
}

/** Isolated so parent re-renders (errors/loading) do not reset visibility toggle. */
const LoginPasswordField = memo(function LoginPasswordField({
  label,
  showLabel,
  hideLabel,
  readOnly = false,
}: {
  label: string;
  showLabel: string;
  hideLabel: string;
  readOnly?: boolean;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <label htmlFor="login-password" className="sr-only">
        {label}
      </label>
      <span className="pointer-events-none absolute left-3 top-1/2 z-[1] -translate-y-1/2 text-muted">
        <LockFieldIcon className="size-5" />
      </span>
      <input
        id="login-password"
        name="password"
        type={visible ? "text" : "password"}
        placeholder={label}
        autoComplete="off"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        required
        readOnly={readOnly}
        className="w-full rounded-xl border border-white/15 bg-transparent py-3 pl-10 pr-11 text-base text-foreground outline-none transition-colors placeholder:text-muted focus:border-primary focus:ring-1 focus:ring-primary/40"
      />
      <div className="absolute right-1 top-1/2 z-[1] -translate-y-1/2">
        <button
          type="button"
          disabled={readOnly}
          className="rounded-lg p-2 text-muted hover:text-foreground disabled:opacity-50"
          aria-label={visible ? hideLabel : showLabel}
          aria-pressed={visible}
          onClick={() => setVisible((v) => !v)}
        >
          {visible ? (
            <EyeIcon className="size-5" />
          ) : (
            <EyeOffIcon className="size-5" />
          )}
        </button>
      </div>
    </div>
  );
});

export function LoginForm({
  initialError = "",
}: {
  initialError?: string;
}) {
  const { t } = useT();
  const [error, setError] = useState(initialError);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (initialError) {
      setError(initialError);
      setBusy(false);
    }
  }, [initialError]);

  // Native form POST only — no client preventDefault / JSON login here.

  const displayError = error || initialError;

  // Plain HTML inputs (no React value/defaultValue) so mobile autofill is not
  // wiped on hydration — a common cause of "wrong password" on phones.
  return (
    <form
      className="space-y-3"
      method="post"
      action="/api/auth/login-form"
      autoComplete="off"
      onSubmit={() => {
        setBusy(true);
        setError("");
      }}
    >
      <div className="relative">
        <label htmlFor="login-username" className="sr-only">
          {t("auth.username")}
        </label>
        <span className="pointer-events-none absolute left-3 top-1/2 z-[1] -translate-y-1/2 text-muted">
          <UserFieldIcon className="size-5" />
        </span>
        <input
          id="login-username"
          name="username"
          type="text"
          inputMode="text"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          placeholder={t("auth.username")}
          autoComplete="off"
          required
          readOnly={busy}
          className="w-full rounded-xl border border-white/15 bg-transparent py-3 pl-10 pr-4 text-base text-foreground outline-none transition-colors placeholder:text-muted focus:border-primary focus:ring-1 focus:ring-primary/40"
        />
      </div>
      <LoginPasswordField
        label={t("auth.password")}
        showLabel={t("auth.showPassword")}
        hideLabel={t("auth.hidePassword")}
        readOnly={busy}
      />
      {displayError ? (
        <p
          role="alert"
          className="rounded-xl border border-danger-border bg-danger/10 px-3 py-2 text-sm font-medium text-error"
        >
          {displayError}
        </p>
      ) : null}
      <PrimaryButton
        type="submit"
        disabled={busy}
        aria-busy={busy}
        className="min-h-[2.75rem]"
        icon={busy ? undefined : <LoginIcon className="size-4 shrink-0" />}
      >
        {busy ? (
          <LoadingSpinner size="sm" label={t("auth.loggingIn")} />
        ) : (
          t("auth.login")
        )}
      </PrimaryButton>
      <p className="text-center text-sm text-muted">
        {t("auth.noAccount")}{" "}
        <Link className="font-medium text-primary" href="/register">
          {t("auth.register")}
        </Link>
      </p>
    </form>
  );
}

export function RegisterForm() {
  const router = useRouter();
  const { t } = useT();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [accountType, setAccountType] = useState<"home" | "retail">("retail");
  const [organizationName, setOrganizationName] = useState("");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<
    Partial<
      Record<
        "organizationName" | "username" | "email" | "password" | "confirmPassword",
        string
      >
    >
  >({});
  const [loading, setLoading] = useState(false);

  function clearFieldError(
    key: "organizationName" | "username" | "email" | "password" | "confirmPassword",
  ) {
    setFieldErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  }

  function setFieldValue(
    key: "organizationName" | "username" | "email" | "password" | "confirmPassword",
    value: string,
    setter: (value: string) => void,
  ) {
    setter(value);
    clearFieldError(key);
    setError("");
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(event.currentTarget);
    const nextUsername = String(formData.get("username") ?? username).trim();
    const nextEmail = String(formData.get("email") ?? email).trim();
    const nextPassword = String(formData.get("password") ?? password);
    const nextConfirm = String(
      formData.get("confirmPassword") ?? confirmPassword,
    );
    const rawAccountType = String(formData.get("accountType") ?? accountType);
    const nextAccountType =
      rawAccountType === "retail" || rawAccountType === "home"
        ? rawAccountType
        : accountType;
    const nextOrg = String(
      formData.get("organizationName") ?? organizationName,
    ).trim();

    setUsername(nextUsername);
    setEmail(nextEmail);
    setPassword(nextPassword);
    setConfirmPassword(nextConfirm);
    setAccountType(nextAccountType);
    setOrganizationName(nextOrg);

    const nextFieldErrors: typeof fieldErrors = {};
    const orgKey = validateOptionalOrgName(nextOrg);
    const usernameKey = validateUsername(nextUsername);
    const emailKey = validateOptionalEmail(nextEmail);
    const passwordKey = validatePassword(nextPassword);

    if (orgKey) nextFieldErrors.organizationName = t(orgKey);
    if (usernameKey) nextFieldErrors.username = t(usernameKey);
    if (emailKey) nextFieldErrors.email = t(emailKey);
    if (passwordKey) nextFieldErrors.password = t(passwordKey);
    if (!nextConfirm) {
      nextFieldErrors.confirmPassword = t("auth.passwordRequired");
    } else if (!passwordsMatch(nextPassword, nextConfirm)) {
      nextFieldErrors.confirmPassword = t("auth.passwordMismatch");
    }

    if (Object.keys(nextFieldErrors).length > 0) {
      setFieldErrors(nextFieldErrors);
      setLoading(false);
      return;
    }

    setFieldErrors({});

    const response = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: nextUsername,
        email: nextEmail || undefined,
        password: nextPassword,
        accountType: nextAccountType,
        organizationName: nextOrg || undefined,
      }),
    });
    const data = await response.json();
    setLoading(false);

    if (!response.ok) {
      setError(data.error ?? t("auth.registerError"));
      return;
    }

    if (shouldOfferPwaInstall()) markPwaInstallOffered();
    router.push("/app");
    router.refresh();
  }

  return (
    <form className="space-y-3.5" onSubmit={onSubmit} noValidate>
      <AccountTypeSwitch
        value={accountType}
        onChange={setAccountType}
        homeLabel={t("auth.accountTypeHome")}
        retailLabel={t("auth.accountTypeRetail")}
        groupLabel={t("auth.accountType")}
      />
      <input type="hidden" name="accountType" value={accountType} />
      <AuthIconField
        compact
        label={t("auth.organizationName")}
        name="organizationName"
        value={organizationName}
        onChange={(value) => setFieldValue("organizationName", value, setOrganizationName)}
        icon={<OrgFieldIcon className="size-4" />}
        error={fieldErrors.organizationName}
        maxLength={ORG_NAME_MAX}
      />
      <AuthIconField
        compact
        label={t("auth.username")}
        name="username"
        value={username}
        autoComplete="username"
        onChange={(value) => setFieldValue("username", value, setUsername)}
        icon={<UserFieldIcon className="size-4" />}
        hint={t("auth.usernameHint")}
        error={fieldErrors.username}
        maxLength={USERNAME_MAX}
        required
      />
      <AuthIconField
        compact
        label={t("auth.emailOptional")}
        name="email"
        type="email"
        value={email}
        autoComplete="email"
        onChange={(value) => setFieldValue("email", value, setEmail)}
        icon={<MailFieldIcon className="size-4" />}
        error={fieldErrors.email}
      />
      <AuthIconField
        compact
        label={t("auth.password")}
        name="password"
        type={showPassword ? "text" : "password"}
        value={password}
        autoComplete="new-password"
        onChange={(value) => setFieldValue("password", value, setPassword)}
        icon={<LockFieldIcon className="size-4" />}
        error={fieldErrors.password}
        maxLength={PASSWORD_MAX}
        required
        trailing={
          <button
            type="button"
            className="rounded-lg p-1.5 text-muted hover:text-foreground"
            aria-label={showPassword ? t("auth.hidePassword") : t("auth.showPassword")}
            aria-pressed={showPassword}
            onMouseDown={(event) => event.preventDefault()}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              setShowPassword((current) => !current);
            }}
          >
            {showPassword ? <EyeIcon className="size-[1.125rem]" /> : <EyeOffIcon className="size-[1.125rem]" />}
          </button>
        }
      />
      <PasswordStrengthBar password={password} />
      <AuthIconField
        compact
        label={t("auth.confirmPassword")}
        name="confirmPassword"
        type={showConfirmPassword ? "text" : "password"}
        value={confirmPassword}
        autoComplete="new-password"
        onChange={(value) => setFieldValue("confirmPassword", value, setConfirmPassword)}
        icon={<LockFieldIcon className="size-4" />}
        error={fieldErrors.confirmPassword}
        maxLength={PASSWORD_MAX}
        required
        trailing={
          <button
            type="button"
            className="rounded-lg p-1.5 text-muted hover:text-foreground"
            aria-label={
              showConfirmPassword ? t("auth.hidePassword") : t("auth.showPassword")
            }
            aria-pressed={showConfirmPassword}
            onMouseDown={(event) => event.preventDefault()}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              setShowConfirmPassword((current) => !current);
            }}
          >
            {showConfirmPassword ? (
              <EyeIcon className="size-[1.125rem]" />
            ) : (
              <EyeOffIcon className="size-[1.125rem]" />
            )}
          </button>
        }
      />
      {error ? <p className="text-sm text-error">{error}</p> : null}
      <p className="text-center text-xs leading-relaxed text-muted">
        {t("legal.registerAgreePrefix")}{" "}
        <Link className="font-medium text-primary underline-offset-2 hover:underline" href="/terms">
          {t("legal.terms")}
        </Link>{" "}
        {t("legal.registerAgreeAnd")}{" "}
        <Link className="font-medium text-primary underline-offset-2 hover:underline" href="/privacy">
          {t("legal.privacy")}
        </Link>
        .
      </p>
      <PrimaryButton type="submit" disabled={loading} className="text-[0.95rem]">
        <span className="inline-flex items-center justify-center gap-1.5">
          <UserPlusIcon className="size-4" />
          {loading ? t("auth.registering") : t("auth.register")}
        </span>
      </PrimaryButton>
      <p className="pt-0.5 text-center text-sm text-muted">
        {t("auth.hasAccount")}{" "}
        <Link className="font-medium text-primary" href="/login">
          {t("auth.login")}
        </Link>
      </p>
    </form>
  );
}

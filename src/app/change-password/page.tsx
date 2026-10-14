"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { KeyIcon } from "@/components/app-nav-icons";
import {
  AuthShell,
  PrimaryButton,
  TextField,
} from "@/components/auth-forms";
import { LanguageSwitch } from "@/components/language-switch";
import { useT } from "@/components/i18n-provider";
import { MobileI18nProvider } from "@/components/mobile-i18n-provider";
import {
  passwordsMatch,
  validatePassword,
} from "@/lib/register-validation";

function ChangePasswordContent() {
  const router = useRouter();
  const { t } = useT();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [confirmError, setConfirmError] = useState("");
  const [loading, setLoading] = useState(false);
  // Submitting before hydration would fall back to a native GET and put the
  // new password in the URL, so keep the button inert until React is live.
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(true);
  }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setPasswordError("");
    setConfirmError("");

    const formData = new FormData(event.currentTarget);
    const nextPassword = String(formData.get("password") ?? password);
    const nextConfirm = String(
      formData.get("confirmPassword") ?? confirmPassword,
    );
    setPassword(nextPassword);
    setConfirmPassword(nextConfirm);

    const passwordKey = validatePassword(nextPassword);
    if (passwordKey) {
      setPasswordError(t(passwordKey));
      setLoading(false);
      return;
    }
    if (!passwordsMatch(nextPassword, nextConfirm)) {
      setConfirmError(t("auth.passwordMismatch"));
      setLoading(false);
      return;
    }

    const response = await fetch("/api/auth/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        password: nextPassword,
        confirmPassword: nextConfirm,
      }),
    });
    const data = await response.json().catch(() => null);
    setLoading(false);

    if (!response.ok) {
      setError(data?.error ?? t("auth.passwordChangeError"));
      return;
    }

    router.push(data?.user?.role === "ADMIN" ? "/admin" : "/app");
    router.refresh();
  }

  return (
    <>
      <div className="flex justify-end px-4 pt-4 sm:absolute sm:right-4 sm:top-4">
        <LanguageSwitch />
      </div>
      <AuthShell
        title={t("auth.changePasswordTitle")}
        subtitle={t("auth.changePasswordSubtitle")}
      >
        <form className="space-y-3" onSubmit={onSubmit} noValidate>
          <TextField
            label={t("auth.newPassword")}
            name="password"
            type="password"
            value={password}
            autoComplete="new-password"
            onChange={(value) => {
              setPassword(value);
              setPasswordError("");
              setError("");
            }}
            error={passwordError}
          />
          <TextField
            label={t("auth.confirmPassword")}
            name="confirmPassword"
            type="password"
            value={confirmPassword}
            autoComplete="new-password"
            onChange={(value) => {
              setConfirmPassword(value);
              setConfirmError("");
              setError("");
            }}
            error={confirmError}
          />
          {error ? <p className="text-sm text-error">{error}</p> : null}
          <PrimaryButton
            type="submit"
            disabled={loading || !ready}
            icon={
              loading ? undefined : <KeyIcon className="size-4 shrink-0" />
            }
          >
            {loading ? t("auth.changingPassword") : t("auth.changePassword")}
          </PrimaryButton>
        </form>
      </AuthShell>
    </>
  );
}

export default function ChangePasswordPage() {
  return (
    <MobileI18nProvider>
      <ChangePasswordContent />
    </MobileI18nProvider>
  );
}
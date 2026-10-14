import { cookies } from "next/headers";
import { AuthShell, LoginForm } from "@/components/auth-forms";
import { MobileI18nProvider } from "@/components/mobile-i18n-provider";
import { t, type Locale, type MessageKey } from "@/i18n";
import { isMobileLocale } from "@/lib/client-locale";

function errorMessageForCode(code: string | undefined, locale: Locale): string {
  if (!code) return "";
  const key: MessageKey | null =
    code === "locked"
      ? "auth.tooManyAttempts"
      : code === "no-client"
        ? "auth.noClientAssigned"
        : code === "credentials" || code === "1"
          ? "auth.invalidCredentials"
          : "auth.loginError";
  return t(key, undefined, locale);
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const cookieStore = await cookies();
  const rawLocale = cookieStore.get("magazin-locale")?.value ?? "";
  const locale: Locale = isMobileLocale(rawLocale) ? rawLocale : "en";
  const initialError = errorMessageForCode(params.error, locale);

  return (
    <MobileI18nProvider>
      <AuthShell
        title={t("auth.loginSubtitle", undefined, locale)}
        showLanguageSwitch
      >
        <LoginForm initialError={initialError} />
      </AuthShell>
    </MobileI18nProvider>
  );
}

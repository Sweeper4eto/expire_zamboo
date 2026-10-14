"use client";

import Link from "next/link";
import { RegisterForm } from "@/components/auth-forms";
import { BrandName } from "@/components/brand-name";
import { LanguageSwitch } from "@/components/language-switch";
import { useT } from "@/components/i18n-provider";
import { MobileI18nProvider } from "@/components/mobile-i18n-provider";

function RegisterPageContent() {
  const { t } = useT();

  return (
    <div className="relative mx-auto flex min-h-svh w-full min-w-0 max-w-md flex-col px-4 pb-6 pt-[max(0.85rem,env(safe-area-inset-top,0px))]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-52 bg-[radial-gradient(ellipse_at_70%_0%,rgb(52_211_153/0.18),transparent_55%)]"
      />

      <div className="relative z-40 mb-5 flex items-center justify-between gap-3">
        <Link
          href="/"
          className="inline-flex items-center gap-2.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          aria-label={t("common.home")}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/landing/brand-mark.png?v=3"
            alt=""
            width={44}
            height={44}
            className="h-11 w-11 object-contain"
            decoding="async"
          />
          <BrandName className="text-xl leading-none" />
        </Link>
        <LanguageSwitch />
      </div>

      <div className="relative z-0 mb-6 flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1 pt-1.5">
          <h1 className="text-[1.55rem] font-semibold leading-tight tracking-tight text-foreground">
            {t("auth.createAccountTitle")}
          </h1>
          <p className="mt-1.5 max-w-[14rem] text-sm leading-snug text-muted">
            {t("auth.registerSubtitle")}
          </p>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/landing/brand-mark.png?v=3"
          alt=""
          width={112}
          height={112}
          className="h-28 w-28 shrink-0 object-contain drop-shadow-[0_0_28px_rgb(52_211_153/0.4)]"
          decoding="async"
        />
      </div>

      <div className="relative z-0 pb-[min(42vh,18rem)]">
        <RegisterForm />
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <MobileI18nProvider>
      <RegisterPageContent />
    </MobileI18nProvider>
  );
}
"use client";

import Link from "next/link";
import { BrandName } from "@/components/brand-name";
import { LanguageSwitch } from "@/components/language-switch";
import { useT } from "@/components/i18n-provider";
import { MobileI18nProvider } from "@/components/mobile-i18n-provider";

function LoginIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
      <path d="M10 17l5-5-5-5" />
      <path d="M15 12H3" />
    </svg>
  );
}

function RegisterIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M19 8v6" />
      <path d="M22 11h-6" />
    </svg>
  );
}

function BellIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10 21a2 2 0 0 0 4 0" />
    </svg>
  );
}

function LeafIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 20A7 7 0 0 1 9.8 7.2C15.5 6.5 19 3 20 2c0 0-1 7-6.5 10.5" />
      <path d="M11 20c0-4 2-7 5-9" />
    </svg>
  );
}

function ChartIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3v18h18" />
      <path d="m7 14 4-4 3 3 5-6" />
    </svg>
  );
}

function ShieldIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

function HomePageContent() {
  const { t } = useT();

  const features = [
    { icon: BellIcon, line1: t("home.featureRemindersLine1"), line2: t("home.featureRemindersLine2") },
    { icon: LeafIcon, line1: t("home.featureWasteLine1"), line2: t("home.featureWasteLine2") },
    { icon: ChartIcon, line1: t("home.featureMoneyLine1"), line2: t("home.featureMoneyLine2") },
    { icon: ShieldIcon, line1: t("home.featureSafeLine1"), line2: t("home.featureSafeLine2") },
  ] as const;

  return (
    <div className="relative mx-auto flex min-h-svh min-w-0 max-w-lg flex-col px-4 pb-10 pt-[max(0.85rem,env(safe-area-inset-top,0px))] sm:px-6">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-[radial-gradient(ellipse_at_50%_0%,rgb(52_211_153/0.16),transparent_60%)]"
      />

      <div className="relative z-40 flex justify-end">
        <LanguageSwitch />
      </div>

      <div className="relative z-0 mt-5 flex w-full flex-col items-center text-center">
        <div className="flex w-full min-w-0 max-w-full items-center justify-center overflow-visible px-2">
          <div className="inline-flex max-w-full items-center justify-center gap-2.5 text-[clamp(1.9rem,8.5vw,2.75rem)] leading-none">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/landing/brand-mark.png?v=3"
              alt={t("home.previewAlt")}
              width={200}
              height={200}
              className="box-border h-[1.55em] w-[1.55em] shrink-0 object-contain"
              decoding="async"
            />
            <BrandName className="shrink-0 whitespace-nowrap text-[1em] leading-none" />
          </div>
        </div>

        <h1 className="mt-8 text-[1.9rem] font-semibold leading-[1.12] tracking-tight sm:text-[2.15rem]">
          <span className="block text-foreground">{t("home.taglineLead")}</span>
          <span className="block text-primary">{t("home.taglineAccent")}</span>
        </h1>

        <p className="mt-3.5 max-w-[21rem] text-[0.92rem] leading-relaxed text-foreground/85">
          <span className="block">{t("home.descriptionLine1")}</span>
          <span className="block">{t("home.descriptionLine2")}</span>
        </p>

        <div className="mt-6 grid w-full max-w-sm grid-cols-2 gap-2.5">
          <Link
            href="/login"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-primary bg-transparent px-2.5 text-sm font-semibold text-primary"
          >
            <LoginIcon className="size-5 shrink-0" />
            {t("home.login")}
          </Link>
          <Link
            href="/register"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-primary bg-transparent px-2.5 text-sm font-semibold text-primary"
          >
            <RegisterIcon className="size-5 shrink-0 text-primary" />
            {t("home.register")}
          </Link>
        </div>

        <div className="mt-7 flex w-full max-w-md items-stretch">
          {features.map((feature, index) => (
            <div
              key={feature.line1}
              className={`flex min-w-0 flex-1 items-center justify-center gap-1 px-1 ${
                index < features.length - 1 ? "border-r border-card-border/70" : ""
              }`}
            >
              <div className="flex min-w-0 items-center gap-1">
                <span className="flex size-7.5 shrink-0 items-center justify-center rounded-full border border-card-border bg-transparent text-primary">
                  <feature.icon className="size-3.5" />
                </span>
                <span className="min-w-0 text-left text-[9px] font-medium leading-[1.15] text-foreground/85 sm:text-[10px]">
                  <span className="block whitespace-nowrap">{feature.line1}</span>
                  <span className="block whitespace-nowrap">{feature.line2}</span>
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 w-full px-1 sm:px-3">
          <div className="mx-auto w-[92%] max-w-[22rem] sm:w-[90%] sm:max-w-[24rem]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/landing/preview-panel.png"
              alt=""
              width={920}
              height={400}
              className="block h-auto w-full rounded-2xl [filter:drop-shadow(-6px_14px_28px_rgb(52_211_153/0.28))]"
              decoding="async"
            />
          </div>
        </div>

        <section className="mt-10 w-full max-w-sm text-center">
          <h2 className="text-base font-semibold text-foreground">
            {t("home.seoTitle")}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            {t("home.seoBody")}
          </p>
        </section>

        <div className="mt-10 w-full max-w-sm border-t border-card-border/70 pt-6 text-center">
          <p className="text-sm text-muted">{t("home.contactCta")}</p>
          <Link
            href="/contact"
            className="mt-2 inline-flex text-sm font-semibold text-primary underline-offset-4 hover:underline"
          >
            {t("home.contactLink")}
          </Link>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-muted">
            <Link href="/terms" className="underline-offset-4 hover:text-foreground hover:underline">
              {t("home.termsLink")}
            </Link>
            <span aria-hidden>·</span>
            <Link href="/privacy" className="underline-offset-4 hover:text-foreground hover:underline">
              {t("home.privacyLink")}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export function HomePage() {
  return (
    <MobileI18nProvider>
      <HomePageContent />
    </MobileI18nProvider>
  );
}
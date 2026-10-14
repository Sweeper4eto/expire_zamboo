"use client";

import Link from "next/link";
import { BackArrowIcon } from "@/components/app-nav-icons";
import { BrandName } from "@/components/brand-name";
import { LanguageSwitch } from "@/components/language-switch";
import { useT } from "@/components/i18n-provider";
import { useMobileLocale } from "@/components/mobile-i18n-provider";
import { MobileI18nProvider } from "@/components/mobile-i18n-provider";
import type { LegalDocument } from "@/content/legal";
import { appButtonCancelFull } from "@/lib/app-ui";

function LegalDocumentContent({
  documentByLocale,
  otherHref,
  otherLabelKey,
}: {
  documentByLocale: Record<"en" | "bg", LegalDocument>;
  otherHref: string;
  otherLabelKey: "legal.privacy" | "legal.terms";
}) {
  const { t } = useT();
  const { locale } = useMobileLocale();
  const doc = documentByLocale[locale] ?? documentByLocale.en;

  return (
    <div className="relative mx-auto flex min-h-svh w-full min-w-0 max-w-lg flex-col px-4 pb-10 pt-[max(1rem,env(safe-area-inset-top,0px))]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[radial-gradient(ellipse_at_70%_0%,rgb(52_211_153/0.12),transparent_55%)]"
      />

      <div className="relative z-10 mb-5 flex items-center justify-between gap-3">
        <Link
          href="/"
          className="inline-flex items-center gap-2.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          aria-label={t("common.home")}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/landing/brand-mark.png?v=3"
            alt=""
            width={40}
            height={40}
            className="h-9 w-9 object-contain"
          />
          <BrandName className="text-lg" />
        </Link>
        <LanguageSwitch />
      </div>

      <div className="relative z-10">
        <div className="mb-1.5 flex items-start justify-between gap-3">
          <h1 className="min-w-0 flex-1 text-2xl font-semibold tracking-tight text-foreground">
            {doc.title}
          </h1>
          <Link
            href="/"
            className="mt-1 inline-flex shrink-0 items-center gap-1 rounded-lg border border-white px-2 py-1 text-xs font-semibold text-white"
          >
            <BackArrowIcon className="size-3.5 shrink-0" />
            {t("common.back")}
          </Link>
        </div>
        <p className="text-sm text-muted">
          {t("legal.lastUpdated")}: {doc.lastUpdated}
        </p>

        <article className="mt-6 space-y-6 text-sm leading-relaxed text-foreground/90">
          {doc.intro.map((paragraph) => (
            <p key={paragraph.slice(0, 48)}>{paragraph}</p>
          ))}

          {doc.sections.map((section) => (
            <section key={section.heading} className="space-y-2">
              <h2 className="text-base font-semibold text-foreground">
                {section.heading}
              </h2>
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph.slice(0, 48)} className="text-muted">
                  {paragraph}
                </p>
              ))}
              {section.bullets?.length ? (
                <ul className="list-disc space-y-1 pl-5 text-muted">
                  {section.bullets.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : null}
            </section>
          ))}
        </article>

        <div className="mt-8 space-y-4 border-t border-card-border pt-5">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
            <Link
              href={otherHref}
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              {t(otherLabelKey)}
            </Link>
            <Link
              href="/contact"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              {t("home.contactLink")}
            </Link>
          </div>

          <Link href="/" className={appButtonCancelFull}>
            <BackArrowIcon className="size-4 shrink-0" />
            {t("support.backToHome")}
          </Link>
        </div>
      </div>
    </div>
  );
}

export function LegalDocumentPage({
  documentByLocale,
  otherHref,
  otherLabelKey,
}: {
  documentByLocale: Record<"en" | "bg", LegalDocument>;
  otherHref: string;
  otherLabelKey: "legal.privacy" | "legal.terms";
}) {
  return (
    <MobileI18nProvider>
      <LegalDocumentContent
        documentByLocale={documentByLocale}
        otherHref={otherHref}
        otherLabelKey={otherLabelKey}
      />
    </MobileI18nProvider>
  );
}

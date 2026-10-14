import type { Metadata } from "next";
import { t } from "@/i18n";

export const metadata: Metadata = {
  title: t("legal.terms"),
  description: t("legal.termsDescription"),
  alternates: { canonical: "/terms" },
  openGraph: {
    title: `${t("legal.terms")} · expire365`,
    description: t("legal.termsDescription"),
    url: "/terms",
  },
  robots: { index: true, follow: true },
};

export default function TermsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
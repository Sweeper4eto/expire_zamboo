import type { Metadata } from "next";
import { t } from "@/i18n";

export const metadata: Metadata = {
  title: t("legal.privacy"),
  description: t("legal.privacyDescription"),
  alternates: { canonical: "/privacy" },
  openGraph: {
    title: `${t("legal.privacy")} · expire365`,
    description: t("legal.privacyDescription"),
    url: "/privacy",
  },
  robots: { index: true, follow: true },
};

export default function PrivacyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
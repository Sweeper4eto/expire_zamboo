import type { Metadata } from "next";
import { t } from "@/i18n";

export const metadata: Metadata = {
  title: t("support.title"),
  description: t("support.guestSubtitle"),
  alternates: { canonical: "/contact" },
  openGraph: {
    title: `${t("support.title")} · expire365`,
    description: t("support.guestSubtitle"),
    url: "/contact",
  },
  robots: { index: true, follow: true },
};

export default function ContactLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
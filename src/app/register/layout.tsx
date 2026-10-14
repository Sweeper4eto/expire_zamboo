import type { Metadata } from "next";
import { t } from "@/i18n";

export const metadata: Metadata = {
  title: t("auth.register"),
  description: t("auth.registerSubtitle"),
  alternates: { canonical: "/register" },
  openGraph: {
    title: `${t("auth.register")} · expire365`,
    description: t("auth.registerSubtitle"),
    url: "/register",
  },
  robots: { index: true, follow: true },
};

export default function RegisterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

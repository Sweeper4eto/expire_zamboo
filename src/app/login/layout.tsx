import type { Metadata } from "next";
import { t } from "@/i18n";

export const metadata: Metadata = {
  title: t("auth.login"),
  description: t("auth.loginSubtitle"),
  alternates: { canonical: "/login" },
  openGraph: {
    title: `${t("auth.login")} · expire365`,
    description: t("auth.loginSubtitle"),
    url: "/login",
  },
  robots: { index: true, follow: true },
};

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

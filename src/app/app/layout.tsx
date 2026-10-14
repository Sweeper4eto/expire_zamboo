import type { Metadata } from "next";
import { AppSessionProvider } from "@/components/app-session-provider";
import { AppShell } from "@/components/app-shell";
import { MobileI18nProvider } from "@/components/mobile-i18n-provider";
import { SessionClientBootstrap } from "@/components/session-client-bootstrap";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <MobileI18nProvider>
      <SessionClientBootstrap />
      <AppSessionProvider>
        <AppShell>{children}</AppShell>
      </AppSessionProvider>
    </MobileI18nProvider>
  );
}

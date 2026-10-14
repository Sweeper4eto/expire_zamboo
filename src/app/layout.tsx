import type { Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { KeepKeyboardFocusVisible } from "@/components/keep-keyboard-focus-visible";
import { PwaInstallPrompt } from "@/components/pwa-install-prompt";
import { PwaRegister } from "@/components/pwa-register";
import { RootClientI18nProvider } from "@/components/root-client-i18n-provider";
import { defaultLocale } from "@/i18n";
import { rootMetadata } from "@/lib/seo";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = rootMetadata;

export const viewport: Viewport = {
  themeColor: "#09090b",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang={defaultLocale}
      className={`${geistSans.variable} ${geistMono.variable} min-h-svh antialiased`}
      style={{ colorScheme: "dark" }}
    >
      <body className="min-h-svh min-w-0 bg-background text-foreground">
        <RootClientI18nProvider>
          {children}
          <KeepKeyboardFocusVisible />
          <PwaRegister />
          <PwaInstallPrompt />
        </RootClientI18nProvider>
      </body>
    </html>
  );
}

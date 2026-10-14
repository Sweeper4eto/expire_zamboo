import type { Metadata } from "next";
import { defaultLocale, t } from "@/i18n";
import { getSiteUrl } from "@/lib/site-url";

const siteUrl = getSiteUrl();
const title = t("metadata.title");
const description = t("metadata.description");
const ogTitle = t("metadata.ogTitle");
const ogDescription = t("metadata.ogDescription");
const keywords = t("metadata.keywords");
const googleVerification = process.env.GOOGLE_SITE_VERIFICATION?.trim();

export const rootMetadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: title,
    template: "%s · expire365",
  },
  description,
  keywords: keywords.split(",").map((k) => k.trim()),
  applicationName: t("common.appName"),
  authors: [{ name: "expire365", url: siteUrl }],
  creator: "expire365",
  publisher: "expire365",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: defaultLocale === "bg" ? "bg_BG" : "en_US",
    url: siteUrl,
    siteName: "expire365",
    title: ogTitle,
    description: ogDescription,
    images: [
      {
        url: "/landing/preview-panel.png",
        width: 920,
        height: 400,
        alt: "expire365 expiry tracking preview",
      },
      {
        url: "/icons/icon-512.png",
        width: 512,
        height: 512,
        alt: "expire365",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: ogTitle,
    description: ogDescription,
    images: ["/landing/preview-panel.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  ...(googleVerification
    ? { verification: { google: googleVerification } }
    : {}),
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: t("common.appName"),
  },
  icons: {
    icon: [
      { url: "/favicon.ico?v=12", sizes: "32x32" },
      { url: "/icons/icon-16.png?v=12", sizes: "16x16", type: "image/png" },
      { url: "/icons/icon-32.png?v=12", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-192.png?v=12", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png?v=12", sizes: "512x512", type: "image/png" },
    ],
    shortcut: "/favicon.ico?v=12",
    apple: "/icons/apple-touch-icon.png?v=12",
  },
  formatDetection: {
    telephone: false,
  },
  category: "business",
};
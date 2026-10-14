import type { MetadataRoute } from "next";
import { defaultLocale, t } from "@/i18n";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: t("metadata.manifestName"),
    short_name: t("common.appName"),
    description: t("metadata.manifestDescription"),
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#09090b",
    theme_color: "#34d399",
    lang: defaultLocale,
    categories: ["business", "productivity"],
    icons: [
      {
        src: "/icons/icon-192.png?v=12",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icons/icon-512.png?v=12",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/icons/icon-512-maskable.png?v=12",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}

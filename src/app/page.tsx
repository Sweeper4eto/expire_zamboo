import { HomePage } from "@/components/home-page";
import { defaultLocale, t } from "@/i18n";
import { getSiteUrl } from "@/lib/site-url";

export default function Page() {
  const siteUrl = getSiteUrl();
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${siteUrl}/#website`,
        name: "expire365",
        url: siteUrl,
        description: t("metadata.description"),
        inLanguage: defaultLocale,
        publisher: { "@id": `${siteUrl}/#organization` },
      },
      {
        "@type": "Organization",
        "@id": `${siteUrl}/#organization`,
        name: "expire365",
        url: siteUrl,
        logo: `${siteUrl}/icons/icon-512.png`,
      },
      {
        "@type": "WebApplication",
        "@id": `${siteUrl}/#app`,
        name: "expire365",
        url: siteUrl,
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        description: t("metadata.description"),
        inLanguage: defaultLocale,
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "EUR",
        },
        featureList: [
          "Barcode scanning",
          "Delivery document import",
          "Expiry date reminders",
          "Multi-location stock tracking",
        ],
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <HomePage />
    </>
  );
}
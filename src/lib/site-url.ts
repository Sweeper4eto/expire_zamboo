/** Public site origin for SEO (canonical, sitemap, Open Graph). */
export function getSiteUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.APP_URL?.trim() ||
    "https://expire365.com";
  return raw.replace(/\/$/, "");
}

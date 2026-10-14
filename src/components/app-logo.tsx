"use client";

import Link from "next/link";
import { useT } from "@/components/i18n-provider";

const LOGO_SRC = "/icons/icon-192.png?v=10";

export function AppLogo({
  size = 72,
  className = "",
  link = true,
}: {
  size?: number;
  className?: string;
  link?: boolean;
}) {
  const { t } = useT();

  // Artwork is tight to the PNG edges; pad + light radius so iPhone never clips it.
  const radiusClass = size >= 64 ? "rounded-2xl" : "rounded-md";

  const image = (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={LOGO_SRC}
      alt="expire365"
      width={size}
      height={size}
      decoding="async"
      className={`box-border max-w-none shrink-0 ${radiusClass} object-contain p-[8%] ${className}`}
      style={{
        width: size,
        height: size,
        minWidth: size,
        minHeight: size,
        maxWidth: size,
        maxHeight: size,
      }}
    />
  );

  if (!link) return image;

  return (
    <Link
      href="/"
      className="inline-flex shrink-0 overflow-visible focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      aria-label={t("common.home")}
      style={{ width: size, height: size, minWidth: size, minHeight: size }}
    >
      {image}
    </Link>
  );
}

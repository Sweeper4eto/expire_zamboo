"use client";

import Link from "next/link";
import { BrandName } from "@/components/brand-name";
import { useT } from "@/components/i18n-provider";

export function AppHeaderLogo({
  size = 44,
  showWordmark = true,
}: {
  size?: number;
  showWordmark?: boolean;
}) {
  const { t } = useT();

  return (
    <Link
      href="/app"
      className="inline-flex shrink-0 items-center gap-2.5 overflow-visible focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      aria-label={t("common.home")}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/landing/brand-mark.png?v=3"
        alt=""
        width={size}
        height={size}
        decoding="sync"
        fetchPriority="high"
        className="box-border shrink-0 object-contain"
        style={{
          width: size,
          height: size,
          minWidth: size,
          minHeight: size,
        }}
      />
      {showWordmark ? <BrandName className="text-xl leading-none" /> : null}
    </Link>
  );
}

import type { ComponentPropsWithoutRef } from "react";
import { ArtMiniMarketScene } from "@/components/goods-placeholder-art-set-b";

/** Production placeholder: #29 mini market scene + mint glow (preview B). */
export const NO_PICTURE_ART_ID = "mini-market-scene" as const;
export const NO_PICTURE_PLACEHOLDER_STYLE = "mint-glow" as const;

type Props = ComponentPropsWithoutRef<"div">;

export function NoPicturePlaceholder({ className = "", ...props }: Props) {
  return (
    <div
      className={`relative flex items-center justify-center overflow-hidden border border-primary/30 bg-zinc-950 ${className}`}
      {...props}
    >
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(52,211,153,0.22),transparent_68%)]"
        aria-hidden
      />
      <div className="relative flex h-[58%] w-[58%] items-center justify-center text-accent">
        <ArtMiniMarketScene className="h-full w-full" />
      </div>
    </div>
  );
}

import type { ReactNode } from "react";

type SvgProps = { className?: string };

function Svg({ className, children }: SvgProps & { children: ReactNode }) {
  return (
    <svg viewBox="0 0 64 64" className={className ?? "h-full w-full"} fill="none" aria-hidden>
      {children}
    </svg>
  );
}

export function ArtMilkCarton({ className }: SvgProps) {
  return (
    <Svg className={className}>
      <path d="M22 14h20l4 8v30H18V22l4-8z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M26 14V10h12v4" stroke="currentColor" strokeWidth="2" />
      <path d="M24 28h16M24 34h12" stroke="currentColor" strokeWidth="1.5" opacity="0.4" />
    </Svg>
  );
}

export function ArtBreadLoaf({ className }: SvgProps) {
  return (
    <Svg className={className}>
      <path d="M14 38c0-12 8-18 18-18s18 6 18 18v8H14v-8z" stroke="currentColor" strokeWidth="2" />
      <path d="M20 30c4-6 10-8 12-8s8 2 12 8" stroke="currentColor" strokeWidth="1.5" opacity="0.4" />
      <path d="M18 46h28" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </Svg>
  );
}

export function ArtApple({ className }: SvgProps) {
  return (
    <Svg className={className}>
      <circle cx="32" cy="36" r="14" stroke="currentColor" strokeWidth="2" />
      <path d="M32 22c2-4 6-6 8-6M32 22v-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M38 18c2 1 3 3 3 5" stroke="currentColor" strokeWidth="1.5" opacity="0.5" />
    </Svg>
  );
}

export function ArtEggCarton({ className }: SvgProps) {
  return (
    <Svg className={className}>
      <path d="M14 30h36v16H14V30z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <ellipse cx="22" cy="38" rx="4" ry="5" stroke="currentColor" strokeWidth="1.5" />
      <ellipse cx="32" cy="38" rx="4" ry="5" stroke="currentColor" strokeWidth="1.5" />
      <ellipse cx="42" cy="38" rx="4" ry="5" stroke="currentColor" strokeWidth="1.5" />
    </Svg>
  );
}

export function ArtCheese({ className }: SvgProps) {
  return (
    <Svg className={className}>
      <path d="M16 44L32 18l16 26H16z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <circle cx="26" cy="34" r="2" fill="currentColor" opacity="0.35" />
      <circle cx="34" cy="30" r="2" fill="currentColor" opacity="0.35" />
      <circle cx="38" cy="38" r="2" fill="currentColor" opacity="0.35" />
    </Svg>
  );
}

export function ArtYogurtCup({ className }: SvgProps) {
  return (
    <Svg className={className}>
      <path d="M22 20h20l-2 28H24L22 20z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M20 20h24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M26 30h12" stroke="currentColor" strokeWidth="1.5" opacity="0.4" />
    </Svg>
  );
}

export function ArtCoffeeBag({ className }: SvgProps) {
  return (
    <Svg className={className}>
      <path d="M20 18h24l4 34H16l4-34z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M24 18c0-4 16-4 16 0" stroke="currentColor" strokeWidth="2" />
      <circle cx="32" cy="34" r="6" stroke="currentColor" strokeWidth="1.5" opacity="0.45" />
    </Svg>
  );
}

export function ArtTeaBox({ className }: SvgProps) {
  return (
    <Svg className={className}>
      <rect x="16" y="18" width="32" height="32" rx="3" stroke="currentColor" strokeWidth="2" />
      <path d="M16 28h32" stroke="currentColor" strokeWidth="1.5" opacity="0.4" />
      <path d="M24 36h16M24 40h10" stroke="currentColor" strokeWidth="1.5" opacity="0.35" />
    </Svg>
  );
}

export function ArtCerealBox({ className }: SvgProps) {
  return (
    <Svg className={className}>
      <rect x="18" y="14" width="28" height="38" rx="2" stroke="currentColor" strokeWidth="2" />
      <rect x="22" y="20" width="20" height="12" rx="1" stroke="currentColor" strokeWidth="1.5" opacity="0.45" />
      <path d="M22 38h20M22 44h14" stroke="currentColor" strokeWidth="1.5" opacity="0.35" />
    </Svg>
  );
}

export function ArtChipsBag({ className }: SvgProps) {
  return (
    <Svg className={className}>
      <path d="M24 12h16l6 40H18l6-40z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M22 22h20M24 32h16" stroke="currentColor" strokeWidth="1.5" opacity="0.4" />
      <circle cx="32" cy="28" r="4" stroke="currentColor" strokeWidth="1.5" opacity="0.35" />
    </Svg>
  );
}

export function ArtWaterBottle({ className }: SvgProps) {
  return (
    <Svg className={className}>
      <rect x="24" y="10" width="16" height="6" rx="2" stroke="currentColor" strokeWidth="2" />
      <path d="M22 16h20v34c0 2-2 4-4 4h-12c-2 0-4-2-4-4V16z" stroke="currentColor" strokeWidth="2" />
      <path d="M24 28h16" stroke="currentColor" strokeWidth="1.5" opacity="0.35" />
    </Svg>
  );
}

export function ArtWineBottle({ className }: SvgProps) {
  return (
    <Svg className={className}>
      <path d="M28 10h8v8c0 4 8 8 8 16v18H20V34c0-8 8-12 8-16v-8z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M22 40h20" stroke="currentColor" strokeWidth="1.5" opacity="0.35" />
    </Svg>
  );
}

export function ArtSixPack({ className }: SvgProps) {
  return (
    <Svg className={className}>
      <rect x="14" y="22" width="12" height="26" rx="2" stroke="currentColor" strokeWidth="1.75" />
      <rect x="26" y="22" width="12" height="26" rx="2" stroke="currentColor" strokeWidth="1.75" />
      <rect x="38" y="22" width="12" height="26" rx="2" stroke="currentColor" strokeWidth="1.75" />
      <path d="M12 22h40" stroke="currentColor" strokeWidth="2" />
    </Svg>
  );
}

export function ArtFrozenPizza({ className }: SvgProps) {
  return (
    <Svg className={className}>
      <rect x="12" y="20" width="40" height="28" rx="2" stroke="currentColor" strokeWidth="2" />
      <circle cx="32" cy="34" r="10" stroke="currentColor" strokeWidth="1.5" opacity="0.45" />
      <path d="M32 24v20M22 34h20" stroke="currentColor" strokeWidth="1.25" opacity="0.3" />
    </Svg>
  );
}

export function ArtIceCream({ className }: SvgProps) {
  return (
    <Svg className={className}>
      <path d="M32 12c6 8 10 14 10 20a10 10 0 11-20 0c0-6 4-12 10-20z" stroke="currentColor" strokeWidth="2" />
      <path d="M24 44l8 10 8-10" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    </Svg>
  );
}

export function ArtMeatSteak({ className }: SvgProps) {
  return (
    <Svg className={className}>
      <path d="M16 36c0-10 8-16 16-16s16 6 16 16" stroke="currentColor" strokeWidth="2" />
      <ellipse cx="32" cy="36" rx="16" ry="10" stroke="currentColor" strokeWidth="2" />
      <path d="M24 34c2 2 6 3 8 3s6-1 8-3" stroke="currentColor" strokeWidth="1.5" opacity="0.4" />
    </Svg>
  );
}

export function ArtFish({ className }: SvgProps) {
  return (
    <Svg className={className}>
      <path d="M12 32c8-8 20-10 32-4l-6 4 6 4c-12 6-24 4-32-4z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <circle cx="38" cy="28" r="2" fill="currentColor" opacity="0.5" />
    </Svg>
  );
}

export function ArtCarrots({ className }: SvgProps) {
  return (
    <Svg className={className}>
      <path d="M28 18c-2 8-2 16 0 28M32 16c0 12 0 22 2 30M36 18c2 8 2 16 0 28" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M26 16c2-4 6-6 10-6M30 14c0-4 4-6 8-4" stroke="currentColor" strokeWidth="1.5" opacity="0.45" />
    </Svg>
  );
}

export function ArtBananas({ className }: SvgProps) {
  return (
    <Svg className={className}>
      <path d="M20 44c8-20 16-26 24-22M24 46c6-14 12-20 20-18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M40 20c2 2 2 6 0 8" stroke="currentColor" strokeWidth="1.5" opacity="0.45" />
    </Svg>
  );
}

export function ArtTomato({ className }: SvgProps) {
  return (
    <Svg className={className}>
      <circle cx="32" cy="36" r="13" stroke="currentColor" strokeWidth="2" />
      <path d="M26 22l6-4 6 4M32 18v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </Svg>
  );
}

export function ArtPastaPack({ className }: SvgProps) {
  return (
    <Svg className={className}>
      <rect x="18" y="16" width="28" height="34" rx="3" stroke="currentColor" strokeWidth="2" />
      <path d="M22 26c4 4 8 4 12 0s8-4 12 0" stroke="currentColor" strokeWidth="1.5" opacity="0.45" />
      <path d="M22 34c4 4 8 4 12 0s8-4 12 0" stroke="currentColor" strokeWidth="1.5" opacity="0.45" />
    </Svg>
  );
}

export function ArtRiceBag({ className }: SvgProps) {
  return (
    <Svg className={className}>
      <path d="M20 18c4-4 20-4 24 0v30c-4 4-20 4-24 0V18z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M24 28h16M24 36h12" stroke="currentColor" strokeWidth="1.5" opacity="0.35" />
    </Svg>
  );
}

export function ArtFlourSack({ className }: SvgProps) {
  return (
    <Svg className={className}>
      <path d="M18 22c8-6 20-6 28 0v26c-8 6-20 6-28 0V22z" stroke="currentColor" strokeWidth="2" />
      <path d="M24 18h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <text x="32" y="38" textAnchor="middle" fontSize="10" fill="currentColor" opacity="0.35">
        kg
      </text>
    </Svg>
  );
}

export function ArtSpiceJars({ className }: SvgProps) {
  return (
    <Svg className={className}>
      <rect x="14" y="26" width="10" height="20" rx="2" stroke="currentColor" strokeWidth="1.75" />
      <rect x="27" y="22" width="10" height="24" rx="2" stroke="currentColor" strokeWidth="1.75" />
      <rect x="40" y="28" width="10" height="18" rx="2" stroke="currentColor" strokeWidth="1.75" />
      <path d="M14 22h10M27 18h10M40 24h10" stroke="currentColor" strokeWidth="1.5" />
    </Svg>
  );
}

export function ArtOliveOil({ className }: SvgProps) {
  return (
    <Svg className={className}>
      <path d="M26 14h12v6l4 30H22l4-30v-6z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M28 36c4 2 8 2 12 0" stroke="currentColor" strokeWidth="1.5" opacity="0.4" />
      <ellipse cx="32" cy="36" rx="6" ry="4" stroke="currentColor" strokeWidth="1.25" opacity="0.35" />
    </Svg>
  );
}

export function ArtHoneyJar({ className }: SvgProps) {
  return (
    <Svg className={className}>
      <path d="M20 26h24v22c0 2-2 4-4 4H24c-2 0-4-2-4-4V26z" stroke="currentColor" strokeWidth="2" />
      <path d="M22 26c0-6 6-10 10-10s10 4 10 10" stroke="currentColor" strokeWidth="2" />
      <path d="M24 36h16" stroke="currentColor" strokeWidth="1.5" opacity="0.35" />
    </Svg>
  );
}

export function ArtPeanutButter({ className }: SvgProps) {
  return (
    <Svg className={className}>
      <rect x="22" y="16" width="20" height="34" rx="4" stroke="currentColor" strokeWidth="2" />
      <rect x="26" y="10" width="12" height="8" rx="2" stroke="currentColor" strokeWidth="2" />
      <path d="M26 28h12M26 36h8" stroke="currentColor" strokeWidth="1.5" opacity="0.35" />
    </Svg>
  );
}

export function ArtShoppingBasket({ className }: SvgProps) {
  return (
    <Svg className={className}>
      <path d="M16 26h32l-4 22H20l-4-22z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M22 18c0 4 20 4 20 0" stroke="currentColor" strokeWidth="2" />
      <circle cx="24" cy="34" r="3" stroke="currentColor" strokeWidth="1.25" />
      <rect x="30" y="31" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.25" />
      <path d="M38 33h4v4h-4" stroke="currentColor" strokeWidth="1.25" />
    </Svg>
  );
}

export function ArtPalletBoxes({ className }: SvgProps) {
  return (
    <Svg className={className}>
      <rect x="12" y="30" width="16" height="14" rx="1" stroke="currentColor" strokeWidth="1.75" />
      <rect x="24" y="24" width="16" height="20" rx="1" stroke="currentColor" strokeWidth="1.75" />
      <rect x="36" y="32" width="16" height="12" rx="1" stroke="currentColor" strokeWidth="1.75" />
      <path d="M10 46h44" stroke="currentColor" strokeWidth="2" opacity="0.35" />
    </Svg>
  );
}

export function ArtProduceBasket({ className }: SvgProps) {
  return (
    <Svg className={className}>
      <path d="M14 30c4-8 32-8 36 0v16c-4 6-32 6-36 0V30z" stroke="currentColor" strokeWidth="2" />
      <circle cx="24" cy="34" r="4" stroke="currentColor" strokeWidth="1.25" />
      <path d="M34 30c0 4 2 8 6 8" stroke="currentColor" strokeWidth="1.25" />
      <path d="M40 32l4-6" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
    </Svg>
  );
}

export function ArtDeliPack({ className }: SvgProps) {
  return (
    <Svg className={className}>
      <rect x="14" y="24" width="36" height="22" rx="3" stroke="currentColor" strokeWidth="2" />
      <path d="M14 32h36" stroke="currentColor" strokeWidth="1.5" opacity="0.35" />
      <rect x="20" y="28" width="10" height="8" rx="1" stroke="currentColor" strokeWidth="1.25" />
      <rect x="34" y="28" width="10" height="8" rx="1" stroke="currentColor" strokeWidth="1.25" />
    </Svg>
  );
}

export function ArtSnackBars({ className }: SvgProps) {
  return (
    <Svg className={className}>
      <rect x="16" y="22" width="32" height="10" rx="2" stroke="currentColor" strokeWidth="1.75" />
      <rect x="18" y="34" width="28" height="10" rx="2" stroke="currentColor" strokeWidth="1.75" />
      <rect x="20" y="46" width="24" height="8" rx="2" stroke="currentColor" strokeWidth="1.75" />
    </Svg>
  );
}

export function ArtLiquorSet({ className }: SvgProps) {
  return (
    <Svg className={className}>
      <path d="M18 18h6v28h-6z" stroke="currentColor" strokeWidth="1.75" />
      <path d="M29 14h6v32h-6z" stroke="currentColor" strokeWidth="1.75" />
      <path d="M40 20h6v26h-6z" stroke="currentColor" strokeWidth="1.75" />
      <path d="M14 46h36" stroke="currentColor" strokeWidth="2" opacity="0.35" />
    </Svg>
  );
}

export function ArtBakeryCroissant({ className }: SvgProps) {
  return (
    <Svg className={className}>
      <path d="M16 38c4-14 12-20 20-18s12 8 12 18" stroke="currentColor" strokeWidth="2" />
      <path d="M20 36c4-6 8-8 12-8s8 2 12 8" stroke="currentColor" strokeWidth="1.5" opacity="0.4" />
    </Svg>
  );
}

export function ArtPetFood({ className }: SvgProps) {
  return (
    <Svg className={className}>
      <rect x="16" y="20" width="32" height="28" rx="4" stroke="currentColor" strokeWidth="2" />
      <path d="M24 16h16v4H24z" stroke="currentColor" strokeWidth="1.75" />
      <ellipse cx="32" cy="34" rx="8" ry="6" stroke="currentColor" strokeWidth="1.5" opacity="0.45" />
    </Svg>
  );
}

export function ArtCleaningSpray({ className }: SvgProps) {
  return (
    <Svg className={className}>
      <path d="M26 14h12v8H26z" stroke="currentColor" strokeWidth="2" />
      <rect x="24" y="22" width="16" height="28" rx="3" stroke="currentColor" strokeWidth="2" />
      <path d="M28 10h8l2 4h-12l2-4z" stroke="currentColor" strokeWidth="1.5" />
    </Svg>
  );
}

export function ArtDiaperPack({ className }: SvgProps) {
  return (
    <Svg className={className}>
      <rect x="16" y="18" width="32" height="30" rx="4" stroke="currentColor" strokeWidth="2" />
      <path d="M22 26h20M22 34h16M22 42h12" stroke="currentColor" strokeWidth="1.5" opacity="0.35" />
    </Svg>
  );
}

export function ArtBatteryPack({ className }: SvgProps) {
  return (
    <Svg className={className}>
      <rect x="18" y="22" width="12" height="24" rx="2" stroke="currentColor" strokeWidth="2" />
      <rect x="34" y="22" width="12" height="24" rx="2" stroke="currentColor" strokeWidth="2" />
      <path d="M24 18v4M40 18v4" stroke="currentColor" strokeWidth="2" />
      <path d="M22 32h4M38 32h4" stroke="currentColor" strokeWidth="1.5" opacity="0.4" />
    </Svg>
  );
}

export function ArtLightBulbBox({ className }: SvgProps) {
  return (
    <Svg className={className}>
      <rect x="14" y="20" width="36" height="28" rx="2" stroke="currentColor" strokeWidth="2" />
      <path d="M32 26c4 0 6 3 6 7s-2 6-4 8v4h-4v-4c-2-2-4-5-4-8s2-7 6-7z" stroke="currentColor" strokeWidth="1.5" />
    </Svg>
  );
}

export function ArtMixedGroceryBag({ className }: SvgProps) {
  return (
    <Svg className={className}>
      <path d="M18 24h28l5 24H13l5-24z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M22 18c0 4 20 4 20 0" stroke="currentColor" strokeWidth="2" />
      <rect x="22" y="30" width="8" height="10" rx="1" stroke="currentColor" strokeWidth="1.25" />
      <circle cx="38" cy="34" r="4" stroke="currentColor" strokeWidth="1.25" />
      <path d="M30 38h8" stroke="currentColor" strokeWidth="1.25" />
    </Svg>
  );
}

export function ArtWarehouseShelf({ className }: SvgProps) {
  return (
    <Svg className={className}>
      <path d="M10 24h44M10 38h44M10 52h44" stroke="currentColor" strokeWidth="2" />
      <rect x="14" y="14" width="10" height="8" rx="1" stroke="currentColor" strokeWidth="1.25" />
      <rect x="28" y="28" width="12" height="8" rx="1" stroke="currentColor" strokeWidth="1.25" />
      <rect x="42" y="42" width="10" height="8" rx="1" stroke="currentColor" strokeWidth="1.25" />
    </Svg>
  );
}

export function ArtBulkCanStack({ className }: SvgProps) {
  return (
    <Svg className={className}>
      <ellipse cx="24" cy="28" rx="8" ry="3" stroke="currentColor" strokeWidth="1.75" />
      <path d="M16 28v16c0 2 4 3 8 3s8-1 8-3V28" stroke="currentColor" strokeWidth="1.75" />
      <ellipse cx="40" cy="32" rx="8" ry="3" stroke="currentColor" strokeWidth="1.75" />
      <path d="M32 32v12c0 2 4 3 8 3s8-1 8-3V32" stroke="currentColor" strokeWidth="1.75" />
    </Svg>
  );
}

export function ArtFreshSalad({ className }: SvgProps) {
  return (
    <Svg className={className}>
      <ellipse cx="32" cy="38" rx="18" ry="10" stroke="currentColor" strokeWidth="2" />
      <path d="M20 34c4-8 8-12 12-12s8 4 12 12" stroke="currentColor" strokeWidth="1.5" opacity="0.45" />
      <path d="M24 30l4 6M32 28l2 8M40 30l-4 6" stroke="currentColor" strokeWidth="1.25" />
    </Svg>
  );
}

export function ArtSausagePack({ className }: SvgProps) {
  return (
    <Svg className={className}>
      <rect x="14" y="28" width="36" height="16" rx="4" stroke="currentColor" strokeWidth="2" />
      <path d="M20 36c4-4 8-4 12 0s8 4 12 0" stroke="currentColor" strokeWidth="1.5" opacity="0.45" />
    </Svg>
  );
}

export function ArtButterBlock({ className }: SvgProps) {
  return (
    <Svg className={className}>
      <rect x="18" y="24" width="28" height="20" rx="3" stroke="currentColor" strokeWidth="2" />
      <path d="M18 32h28" stroke="currentColor" strokeWidth="1.5" opacity="0.35" />
      <path d="M26 24v20M38 24v20" stroke="currentColor" strokeWidth="1.25" opacity="0.25" />
    </Svg>
  );
}

export function ArtOrangeJuice({ className }: SvgProps) {
  return (
    <Svg className={className}>
      <rect x="20" y="18" width="24" height="32" rx="3" stroke="currentColor" strokeWidth="2" />
      <circle cx="32" cy="30" r="6" stroke="currentColor" strokeWidth="1.5" opacity="0.45" />
      <path d="M28 30h8M32 26v8" stroke="currentColor" strokeWidth="1.25" opacity="0.35" />
    </Svg>
  );
}

export function ArtChocolateBar({ className }: SvgProps) {
  return (
    <Svg className={className}>
      <rect x="16" y="24" width="32" height="20" rx="2" stroke="currentColor" strokeWidth="2" />
      <path d="M24 24v20M32 24v20M40 24v20M16 34h32" stroke="currentColor" strokeWidth="1.25" opacity="0.35" />
    </Svg>
  );
}

export function ArtLaundryDetergent({ className }: SvgProps) {
  return (
    <Svg className={className}>
      <path d="M22 16h20l2 34H20l2-34z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M24 12h16v4H24z" stroke="currentColor" strokeWidth="2" />
      <path d="M26 28h12M26 36h8" stroke="currentColor" strokeWidth="1.5" opacity="0.35" />
    </Svg>
  );
}

export function ArtTinnedSoup({ className }: SvgProps) {
  return (
    <Svg className={className}>
      <rect x="22" y="16" width="20" height="32" rx="3" stroke="currentColor" strokeWidth="2" />
      <ellipse cx="32" cy="16" rx="10" ry="3" stroke="currentColor" strokeWidth="2" />
      <path d="M26 28h12M26 36h8" stroke="currentColor" strokeWidth="1.5" opacity="0.35" />
    </Svg>
  );
}

export function ArtGiftHamper({ className }: SvgProps) {
  return (
    <Svg className={className}>
      <rect x="14" y="26" width="36" height="22" rx="2" stroke="currentColor" strokeWidth="2" />
      <path d="M32 26V16M22 20c0-4 4-6 10-4M42 20c0-4-4-6-10-4" stroke="currentColor" strokeWidth="2" />
      <path d="M32 16v10" stroke="currentColor" strokeWidth="2" />
    </Svg>
  );
}

export function ArtMiniMarketScene({ className }: SvgProps) {
  return (
    <Svg className={className}>
      <path d="M12 46h40" stroke="currentColor" strokeWidth="2" />
      <rect x="16" y="28" width="10" height="18" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <rect x="28" y="24" width="8" height="22" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="44" cy="36" r="5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M20 20h24l-4 8H24l-4-8z" stroke="currentColor" strokeWidth="1.5" />
    </Svg>
  );
}

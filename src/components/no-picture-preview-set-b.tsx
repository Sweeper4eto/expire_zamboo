import type { ComponentType, ReactNode } from "react";
import {
  ArtApple,
  ArtBakeryCroissant,
  ArtBananas,
  ArtBreadLoaf,
  ArtCarrots,
  ArtCerealBox,
  ArtCheese,
  ArtChipsBag,
  ArtDeliPack,
  ArtEggCarton,
  ArtFish,
  ArtFreshSalad,
  ArtFrozenPizza,
  ArtGiftHamper,
  ArtHoneyJar,
  ArtIceCream,
  ArtMeatSteak,
  ArtMilkCarton,
  ArtMiniMarketScene,
  ArtMixedGroceryBag,
  ArtOrangeJuice,
  ArtPastaPack,
  ArtProduceBasket,
  ArtRiceBag,
  ArtShoppingBasket,
  ArtTomato,
  ArtWarehouseShelf,
  ArtWaterBottle,
  ArtWineBottle,
  ArtYogurtCup,
} from "@/components/goods-placeholder-art-set-b";

/** Preview-only — not wired into ProductImage. */
export type GoodsPreviewVariant =
  | "milk-carton"
  | "bread-loaf"
  | "apple"
  | "egg-carton"
  | "cheese"
  | "yogurt-cup"
  | "cereal-box"
  | "chips-bag"
  | "water-bottle"
  | "wine-bottle"
  | "frozen-pizza"
  | "ice-cream"
  | "meat-steak"
  | "fish"
  | "carrots"
  | "bananas"
  | "tomato"
  | "pasta-pack"
  | "rice-bag"
  | "honey-jar"
  | "shopping-basket"
  | "produce-basket"
  | "deli-pack"
  | "bakery-croissant"
  | "mixed-grocery-bag"
  | "warehouse-shelf"
  | "fresh-salad"
  | "orange-juice"
  | "mini-market-scene"
  | "gift-hamper";

export const GOODS_PREVIEW_VARIANTS: Array<{
  id: GoodsPreviewVariant;
  title: string;
  description: string;
  tone?: "default" | "mint" | "soft";
}> = [
  { id: "milk-carton", title: "1. Milk carton", description: "Fresh dairy — everyday grocery staple." },
  { id: "bread-loaf", title: "2. Bread loaf", description: "Bakery bread — bakery / fresh goods." },
  { id: "apple", title: "3. Apple", description: "Single fruit — produce section." },
  { id: "egg-carton", title: "4. Egg carton", description: "Eggs pack — chilled / fresh items." },
  { id: "cheese", title: "5. Cheese wedge", description: "Cheese triangle — deli / dairy." },
  { id: "yogurt-cup", title: "6. Yogurt cup", description: "Cup yogurt — short-life refrigerated product." },
  { id: "cereal-box", title: "7. Cereal box", description: "Breakfast box — dry packaged goods." },
  { id: "chips-bag", title: "8. Chips bag", description: "Snack bag — impulse / packaged snacks." },
  { id: "water-bottle", title: "9. Water bottle", description: "Still water — beverages." },
  { id: "wine-bottle", title: "10. Wine bottle", description: "Wine — bottles with expiry relevance." },
  { id: "frozen-pizza", title: "11. Frozen pizza", description: "Frozen meal box — freezer aisle." },
  { id: "ice-cream", title: "12. Ice cream", description: "Cone + tub feel — frozen desserts." },
  { id: "meat-steak", title: "13. Meat steak", description: "Raw meat cut — butcher / fresh protein." },
  { id: "fish", title: "14. Fish", description: "Fish fillet — seafood counter." },
  { id: "carrots", title: "15. Carrot bundle", description: "Vegetable bunch — produce." },
  { id: "bananas", title: "16. Bananas", description: "Banana bunch — fast-turnover fruit." },
  { id: "tomato", title: "17. Tomato", description: "Tomato with stem — fresh produce." },
  { id: "pasta-pack", title: "18. Pasta pack", description: "Pasta in box — dry groceries." },
  { id: "rice-bag", title: "19. Rice bag", description: "Rice sack — bulk dry goods." },
  { id: "honey-jar", title: "20. Honey jar", description: "Honey jar — preserves / spreads." },
  { id: "shopping-basket", title: "21. Shopping basket", description: "Basket with mixed items — general store." },
  { id: "produce-basket", title: "22. Produce basket", description: "Basket of fruit & veg — market feel." },
  { id: "deli-pack", title: "23. Deli pack", description: "Sealed tray with portions — ready meals / deli." },
  { id: "bakery-croissant", title: "24. Croissant", description: "Pastry — bakery counter." },
  { id: "mixed-grocery-bag", title: "25. Mixed grocery bag", description: "Bag with box + fruit — varied inventory." },
  { id: "warehouse-shelf", title: "26. Warehouse shelf", description: "Stacked shelf units — stock / backroom." },
  { id: "fresh-salad", title: "27. Fresh salad", description: "Salad bowl — prepared fresh food." },
  { id: "orange-juice", title: "28. Orange juice", description: "Juice carton with citrus — beverages." },
  { id: "mini-market-scene", title: "29. Mini market scene", description: "Small shelf scene — multiple goods at once." },
  { id: "gift-hamper", title: "30. Gift hamper", description: "Hamper box with ribbon — bundled goods." },
];

const ART: Record<GoodsPreviewVariant, ComponentType<{ className?: string }>> = {
  "milk-carton": ArtMilkCarton,
  "bread-loaf": ArtBreadLoaf,
  apple: ArtApple,
  "egg-carton": ArtEggCarton,
  cheese: ArtCheese,
  "yogurt-cup": ArtYogurtCup,
  "cereal-box": ArtCerealBox,
  "chips-bag": ArtChipsBag,
  "water-bottle": ArtWaterBottle,
  "wine-bottle": ArtWineBottle,
  "frozen-pizza": ArtFrozenPizza,
  "ice-cream": ArtIceCream,
  "meat-steak": ArtMeatSteak,
  fish: ArtFish,
  carrots: ArtCarrots,
  bananas: ArtBananas,
  tomato: ArtTomato,
  "pasta-pack": ArtPastaPack,
  "rice-bag": ArtRiceBag,
  "honey-jar": ArtHoneyJar,
  "shopping-basket": ArtShoppingBasket,
  "produce-basket": ArtProduceBasket,
  "deli-pack": ArtDeliPack,
  "bakery-croissant": ArtBakeryCroissant,
  "mixed-grocery-bag": ArtMixedGroceryBag,
  "warehouse-shelf": ArtWarehouseShelf,
  "fresh-salad": ArtFreshSalad,
  "orange-juice": ArtOrangeJuice,
  "mini-market-scene": ArtMiniMarketScene,
  "gift-hamper": ArtGiftHamper,
};

function Shell({
  className,
  children,
  tone = "default",
}: {
  className?: string;
  children: ReactNode;
  tone?: "default" | "mint" | "soft";
}) {
  const toneClass =
    tone === "mint"
      ? "border-primary/25 bg-zinc-950"
      : tone === "soft"
        ? "border-card-border bg-zinc-800/45"
        : "border-card-border bg-zinc-950/55";

  return (
    <div
      className={`relative flex items-center justify-center overflow-hidden rounded-xl border ${toneClass} ${className ?? ""}`}
    >
      {tone === "mint" ? (
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(52,211,153,0.14),transparent_70%)]" />
      ) : null}
      <div className="relative flex h-[62%] w-[62%] items-center justify-center text-muted/85">
        {children}
      </div>
    </div>
  );
}

export function GoodsPreviewPlaceholder({
  variant,
  className = "",
}: {
  variant: GoodsPreviewVariant;
  className?: string;
}) {
  const meta = GOODS_PREVIEW_VARIANTS.find((item) => item.id === variant);
  const Art = ART[variant];
  const tone = meta?.tone ?? "default";

  return (
    <Shell className={className} tone={tone}>
      <Art className={tone === "mint" ? "text-primary/80" : undefined} />
    </Shell>
  );
}

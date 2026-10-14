"use client";

import { useState } from "react";
import {
  GOODS_PREVIEW_VARIANTS,
  GoodsPreviewPlaceholder,
  type GoodsPreviewVariant,
} from "@/components/no-picture-preview-set-b";
import { ProductImage } from "@/components/product-image";

const SIZES = [
  { name: "Thumbnail", className: "size-14 rounded-xl" },
  { name: "Card", className: "size-24 rounded-xl" },
  { name: "Detail", className: "aspect-square w-full max-w-[220px] rounded-xl" },
];

export default function NoPictureDesignPage() {
  const [selected, setSelected] = useState<GoodsPreviewVariant | null>(null);

  return (
    <div className="mx-auto min-h-full max-w-5xl px-4 py-8 pb-16">
      <header className="mb-8">
        <p className="text-sm text-primary">Magazin — preview only</p>
        <h1 className="mt-1 text-2xl font-semibold">30 goods placeholders — pick 1–30</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Each card shows a product illustration (food, drinks, produce, etc.). Nothing here is
          applied to the app until you choose a number and explicitly ask to implement it.
        </p>
        {selected ? (
          <p className="mt-3 rounded-xl border border-primary/40 bg-primary/10 px-4 py-2 text-sm text-primary">
            Selected:{" "}
            <strong>{GOODS_PREVIEW_VARIANTS.find((v) => v.id === selected)?.title}</strong>
          </p>
        ) : (
          <p className="mt-3 text-sm text-muted">Click a card to mark your favourite.</p>
        )}
      </header>

      <section className="mb-10 rounded-2xl border border-card-border p-4">
        <h2 className="text-sm font-medium text-muted">Live in app (#29 + mint glow)</h2>
        <div className="mt-3 flex flex-wrap gap-6">
          {SIZES.map((size) => (
            <div key={size.name} className="text-center">
              <ProductImage src={null} alt="" placeholderClassName={size.className} />
              <p className="mt-2 text-xs text-muted">{size.name}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {GOODS_PREVIEW_VARIANTS.map((option) => {
          const active = selected === option.id;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => setSelected(option.id)}
              className={`rounded-2xl border p-4 text-left transition-colors ${
                active
                  ? "border-primary bg-primary/10 ring-1 ring-primary/40"
                  : "border-card-border hover:border-zinc-500"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium">{option.title}</p>
                  <p className="mt-1 text-xs text-muted">{option.description}</p>
                </div>
                {active ? (
                  <span className="shrink-0 rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-fg">
                    ✓
                  </span>
                ) : null}
              </div>
              <div className="mt-3 flex justify-center">
                <GoodsPreviewPlaceholder variant={option.id} className="size-20 rounded-xl" />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

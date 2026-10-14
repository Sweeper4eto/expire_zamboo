import { barcodeLookupValues, normalizeBarcode } from "@/lib/barcode";
import {
  cleanProductName,
  isLowQualityProductName,
  pickBestProductName,
} from "@/lib/product-name";

export type OpenFoodFactsProduct = {
  barcode: string;
  name: string;
  imageUrl: string | null;
};

type OffProductPayload = {
  product_name?: string;
  product_name_bg?: string;
  product_name_en?: string;
  generic_name?: string;
  brands?: string;
  image_front_small_url?: string;
  image_front_url?: string;
  image_small_url?: string;
  image_url?: string;
};

type OffApiResponse = {
  status?: number;
  product?: OffProductPayload;
};

const OFF_USER_AGENT =
  "Magazin/1.0 (https://github.com/Sweeper4eto/barcodescanner; barcode inventory app)";

export function pickOpenFoodFactsName(product: OffProductPayload): string {
  const bg = cleanProductName(product.product_name_bg || "");
  if (bg && !isLowQualityProductName(bg)) return bg;

  return pickBestProductName([
    product.product_name,
    product.product_name_en,
    product.generic_name,
    product.brands,
  ]);
}

/** Prefer larger CDN variants; OFF often returns tiny .200 thumbnails. */
export function preferLargerProductImageUrl(url: string): string {
  return url.replace(/\.(100|200)\./g, ".400.");
}

export function pickOpenFoodFactsImageUrl(
  product: OffProductPayload,
): string | null {
  // Prefer normal front/url over small thumbnails.
  const candidates = [
    product.image_front_url,
    product.image_url,
    product.image_front_small_url,
    product.image_small_url,
  ];
  for (const candidate of candidates) {
    const url = candidate?.trim();
    if (url && /^https?:\/\//i.test(url)) {
      return preferLargerProductImageUrl(url);
    }
  }
  return null;
}

export async function lookupOpenFoodFactsProduct(
  value: string,
  fetchImpl: typeof fetch = fetch,
): Promise<OpenFoodFactsProduct | null> {
  const barcode = normalizeBarcode(value);
  if (!barcode) return null;

  for (const code of barcodeLookupValues(barcode)) {
    try {
      const response = await fetchImpl(
        `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json`,
        {
          headers: {
            "User-Agent": OFF_USER_AGENT,
            Accept: "application/json",
          },
          signal: AbortSignal.timeout(8000),
        },
      );
      if (!response.ok) continue;

      const data = (await response.json()) as OffApiResponse;
      if (data.status !== 1 || !data.product) continue;

      const name = pickOpenFoodFactsName(data.product);
      if (!name) continue;

      return {
        barcode,
        name,
        imageUrl: pickOpenFoodFactsImageUrl(data.product),
      };
    } catch {
      // try next
    }
  }

  return null;
}

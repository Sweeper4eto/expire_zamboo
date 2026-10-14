import { normalizeBarcode } from "@/lib/barcode";

export type ScanLookupProduct = {
  id: string;
  name: string;
  imagePath: string | null;
  barcode: string;
};

export type ScanLookupResult =
  | { status: "found"; barcode: string; product: ScanLookupProduct; source?: string }
  | { status: "missing"; barcode: string }
  | { status: "error"; message: string }
  | { status: "unauthorized" };

type ResolveResponse = {
  status?: "found" | "missing" | "suggestion";
  source?: string;
  product?: ScanLookupProduct;
  barcode?: string;
  error?: string;
};

export async function lookupProductByBarcode(
  value: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ScanLookupResult> {
  const barcode = normalizeBarcode(value);
  if (!barcode) {
    return { status: "error", message: "INVALID_BARCODE" };
  }

  try {
    const response = await fetchImpl("/api/products/resolve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ barcode, importExternal: true }),
    });

    if (response.status === 401) {
      return { status: "unauthorized" };
    }

    const data = (await response.json().catch(() => null)) as ResolveResponse | null;
    if (!response.ok || !data) {
      return { status: "error", message: data?.error ?? "LOOKUP_FAILED" };
    }

    if (data.status === "found" && data.product) {
      return {
        status: "found",
        barcode: data.product.barcode,
        product: data.product,
        source: data.source,
      };
    }

    return { status: "missing", barcode: data.barcode ?? barcode };
  } catch {
    return { status: "error", message: "NETWORK_ERROR" };
  }
}

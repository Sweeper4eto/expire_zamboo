import type { ScanLookupResult } from "@/lib/scan-barcode-lookup";
import { navigateApp } from "@/lib/app-navigation";

type LookupHandlers<TStep extends string> = {
  setMessage: (message: string) => void;
  setBarcode: (barcode: string) => void;
  setProduct: (product: {
    id: string;
    name: string;
    imagePath: string | null;
    barcode: string;
  }) => void;
  goToStep: (step: TStep) => void;
  t: (key: "errors.networkError" | "errors.lookupFailed") => string;
};

export function applyLookupResult<TStep extends string>(
  result: ScanLookupResult,
  handlers: LookupHandlers<TStep>,
) {
  switch (result.status) {
    case "unauthorized":
      navigateApp("/login");
      return;
    case "error":
      handlers.setMessage(
        result.message === "NETWORK_ERROR"
          ? handlers.t("errors.networkError")
          : handlers.t("errors.lookupFailed"),
      );
      return;
    case "missing":
      handlers.setBarcode(result.barcode);
      handlers.goToStep("missing" as TStep);
      return;
    case "found":
      handlers.setBarcode(result.barcode);
      handlers.setProduct(result.product);
      handlers.goToStep("date" as TStep);
      return;
  }
}

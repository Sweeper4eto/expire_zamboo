export type ScanWizardStep = "scan" | "missing" | "name" | "date";
export type AddProductWizardStep = "scan" | "name" | "photo" | "confirm";

export function getPreviousScanStep(
  step: ScanWizardStep,
  hasProduct: boolean,
): ScanWizardStep | null {
  switch (step) {
    case "date":
      return hasProduct ? "scan" : "name";
    case "name":
    case "missing":
      return "scan";
    default:
      return null;
  }
}

export function getPreviousAddProductStep(
  step: AddProductWizardStep,
  initialBarcode: string,
): AddProductWizardStep | null {
  switch (step) {
    case "confirm":
      return "photo";
    case "photo":
      return "name";
    case "name":
      return initialBarcode ? null : "scan";
    default:
      return null;
  }
}

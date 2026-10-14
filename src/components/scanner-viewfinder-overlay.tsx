type ScannerViewfinderVariant = "barcode" | "document";

export function ScannerViewfinderOverlay({
  variant = "barcode",
  showScanLine = true,
}: {
  variant?: ScannerViewfinderVariant;
  showScanLine?: boolean;
}) {
  return (
    <div className="scanner-overlay" aria-hidden>
      <div
        className={`scanner-viewfinder${
          variant === "document" ? " scanner-viewfinder-document" : ""
        }`}
      >
        <span className="scanner-corner scanner-corner-tl" />
        <span className="scanner-corner scanner-corner-tr" />
        <span className="scanner-corner scanner-corner-bl" />
        <span className="scanner-corner scanner-corner-br" />
        {showScanLine ? <span className="scanner-line" /> : null}
      </div>
    </div>
  );
}
import type { DocumentOcrRow } from "@/lib/document-ai";

function ymdOffset(daysFromToday: number): string {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + daysFromToday);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Fake OCR rows for local document-review UI testing when real AI is off.
 * Varied so the review screen shows matches, missing expiry, multi-qty, etc.
 */
export function mockDocumentOcrRows(): DocumentOcrRow[] {
  return [
    {
      name: "Мляко Верея 3.6% 1л",
      barcode: "3800123456001",
      articul: "MLK-360",
      expiryYmd: ymdOffset(12),
      quantity: 24,
    },
    {
      name: "Кисело мляко Балкан 400г",
      barcode: "3800123456002",
      articul: "YOG-400",
      expiryYmd: ymdOffset(5),
      quantity: 12,
    },
    {
      name: "Сирене бяло Краве 400г",
      barcode: null,
      articul: "CHS-400",
      expiryYmd: ymdOffset(45),
      quantity: 6,
    },
    {
      name: "Масло Краве 250г",
      barcode: "3800123456004",
      articul: null,
      expiryYmd: null, // missing expiry — review warning
      quantity: 8,
    },
    {
      name: "Старо сирене (просрочено)",
      barcode: "3800123456009",
      articul: "OLD-CHS",
      expiryYmd: ymdOffset(-14), // expired — red review card
      quantity: 3,
    },
    {
      name: "Хляб Добруджа 650г",
      barcode: "3800123456005",
      articul: "BRD-650",
      expiryYmd: ymdOffset(2),
      quantity: 10,
    },
    {
      name: "Йогурт питие праскова 320мл",
      barcode: null,
      articul: "DRK-320",
      expiryYmd: ymdOffset(18),
      quantity: 18,
    },
    {
      name: "Кашкавал Витоша 300г",
      barcode: "3800123456007",
      articul: "KSH-300",
      expiryYmd: ymdOffset(60),
      quantity: 4,
    },
    {
      name: "Яйца размер M 10бр",
      barcode: "3800123456008",
      articul: "EGG-M10",
      expiryYmd: ymdOffset(21),
      quantity: 1,
    },
  ];
}

/** Use mocks in local DEV unless OCR_MOCK=0, or when OCR_MOCK=1 explicitly. */
export function shouldMockDocumentOcr(): boolean {
  if (process.env.OCR_MOCK === "1") return true;
  if (process.env.OCR_MOCK === "0") return false;
  return process.env.NODE_ENV !== "production";
}

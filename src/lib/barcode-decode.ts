import {
  BarcodeFormat,
  BinaryBitmap,
  DecodeHintType,
  GlobalHistogramBinarizer,
  HybridBinarizer,
  MultiFormatReader,
  RGBLuminanceSource,
} from "@zxing/library";
import type { Html5Qrcode } from "html5-qrcode";
import { isPlausibleBarcode, normalizeBarcode } from "@/lib/barcode";

export type BarcodeDecodeSource =
  | "live"
  | "html5"
  | "zxing-hybrid"
  | "zxing-global"
  | "zxing-wasm"
  | "native"
  | "wasm-detector";

export type BarcodeDecodeHit = {
  code: string;
  source: BarcodeDecodeSource;
};

const PRODUCT_FORMATS = [
  BarcodeFormat.EAN_13,
  BarcodeFormat.EAN_8,
  BarcodeFormat.UPC_A,
  BarcodeFormat.UPC_E,
  BarcodeFormat.CODE_128,
  BarcodeFormat.CODE_39,
  BarcodeFormat.ITF,
];

const DETECTOR_FORMATS = [
  "ean_13",
  "ean_8",
  "upc_a",
  "upc_e",
  "code_128",
  "code_39",
  "itf",
] as const;

const WASM_FORMATS = [
  "EAN13",
  "EAN8",
  "UPCA",
  "UPCE",
  "Code128",
  "Code39",
  "ITF",
] as const;

type DetectedBarcode = {
  rawValue: string;
};

type DetectorLike = {
  detect(
    image: HTMLVideoElement | HTMLCanvasElement | ImageBitmap,
  ): Promise<DetectedBarcode[]>;
};

let zxingReader: MultiFormatReader | null = null;
let browserDetector: DetectorLike | null | undefined;
let wasmDetector: DetectorLike | null | undefined;
let decodersReady: Promise<void> | null = null;

function getZxingReader(): MultiFormatReader {
  if (!zxingReader) {
    const hints = new Map();
    hints.set(DecodeHintType.POSSIBLE_FORMATS, PRODUCT_FORMATS);
    hints.set(DecodeHintType.TRY_HARDER, true);
    hints.set(DecodeHintType.ASSUME_GS1, false);
    zxingReader = new MultiFormatReader();
    zxingReader.setHints(hints);
  }
  return zxingReader;
}

function getBrowserDetector(): DetectorLike | null {
  if (browserDetector !== undefined) return browserDetector;
  if (typeof window === "undefined" || !("BarcodeDetector" in window)) {
    browserDetector = null;
    return null;
  }
  try {
    const Detector = (
      window as Window & {
        BarcodeDetector?: new (options?: { formats?: string[] }) => DetectorLike;
      }
    ).BarcodeDetector;
    browserDetector = Detector ? new Detector({ formats: [...DETECTOR_FORMATS] }) : null;
  } catch {
    browserDetector = null;
  }
  return browserDetector;
}

async function getWasmDetector(): Promise<DetectorLike | null> {
  if (wasmDetector !== undefined) return wasmDetector;
  if (typeof window === "undefined") {
    wasmDetector = null;
    return null;
  }
  try {
    const { BarcodeDetector } = await import("barcode-detector/ponyfill");
    wasmDetector = new BarcodeDetector({ formats: [...DETECTOR_FORMATS] });
  } catch {
    wasmDetector = null;
  }
  return wasmDetector;
}

/** Warm WASM engines before the camera starts. */
export async function prepareBarcodeDecoders(): Promise<void> {
  if (!decodersReady) {
    decodersReady = (async () => {
      const { prepareZXingModule } = await import("zxing-wasm/reader");
      await Promise.all([
        prepareZXingModule({ fireImmediately: true }),
        getWasmDetector(),
      ]);
    })();
  }
  await decodersReady;
}

function acceptDecoded(
  raw: string,
  source: BarcodeDecodeSource,
): BarcodeDecodeHit | null {
  const code = normalizeBarcode(raw);
  if (!isPlausibleBarcode(code)) return null;
  return { code, source };
}

function collectHits(
  hits: BarcodeDecodeHit[],
  seen: Set<string>,
  candidates: Array<BarcodeDecodeHit | null | undefined>,
): void {
  for (const hit of candidates) {
    if (!hit) continue;
    const key = `${hit.source}:${hit.code}`;
    if (seen.has(key)) continue;
    seen.add(key);
    hits.push(hit);
  }
}

function decodeWithZxing(
  imageData: ImageData,
  source: "zxing-hybrid" | "zxing-global",
): BarcodeDecodeHit | null {
  const luminanceSource = new RGBLuminanceSource(
    imageData.data,
    imageData.width,
    imageData.height,
  );
  const binaryBitmap = new BinaryBitmap(
    source === "zxing-hybrid"
      ? new HybridBinarizer(luminanceSource)
      : new GlobalHistogramBinarizer(luminanceSource),
  );

  try {
    const result = getZxingReader().decode(binaryBitmap);
    return acceptDecoded(result.getText(), source);
  } catch {
    return null;
  }
}

async function decodeWithZxingWasm(
  imageData: ImageData,
  inverted = false,
): Promise<BarcodeDecodeHit | null> {
  try {
    const { readBarcodes } = await import("zxing-wasm/reader");
    const input = inverted ? invertImageData(imageData) : imageData;
    const results = await readBarcodes(input, {
      formats: [...WASM_FORMATS],
      tryHarder: true,
      tryInvert: !inverted,
      tryRotate: true,
      tryDenoise: true,
      maxNumberOfSymbols: 4,
    });
    for (const result of results) {
      const hit = acceptDecoded(result.text, "zxing-wasm");
      if (hit) return hit;
    }
  } catch {
    // WASM decode is best-effort.
  }
  return null;
}

async function decodeWithHtml5(
  fileDecoder: Html5Qrcode,
  canvas: HTMLCanvasElement,
): Promise<BarcodeDecodeHit | null> {
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/png");
  });
  if (!blob) return null;

  const file = new File([blob], "barcode-frame.png", { type: "image/png" });

  try {
    const decoded = await fileDecoder.scanFile(file, false);
    return acceptDecoded(decoded, "html5");
  } catch {
    return null;
  }
}

async function decodeWithDetector(
  detector: DetectorLike,
  source: "native" | "wasm-detector",
  target: HTMLVideoElement | HTMLCanvasElement | ImageBitmap,
): Promise<BarcodeDecodeHit | null> {
  try {
    const results = await detector.detect(target);
    for (const result of results) {
      const hit = acceptDecoded(result.rawValue, source);
      if (hit) return hit;
    }
  } catch {
    // Detector support varies by frame type and browser.
  }
  return null;
}

function invertImageData(imageData: ImageData): ImageData {
  const inverted = new ImageData(
    new Uint8ClampedArray(imageData.data),
    imageData.width,
    imageData.height,
  );
  for (let index = 0; index < inverted.data.length; index += 4) {
    inverted.data[index] = 255 - inverted.data[index];
    inverted.data[index + 1] = 255 - inverted.data[index + 1];
    inverted.data[index + 2] = 255 - inverted.data[index + 2];
  }
  return inverted;
}

async function decodeImageData(
  imageData: ImageData,
  fileDecoder: Html5Qrcode,
  canvas: HTMLCanvasElement,
  includeInverted: boolean,
): Promise<BarcodeDecodeHit[]> {
  const hits: BarcodeDecodeHit[] = [];
  const seen = new Set<string>();

  const inverted = includeInverted ? invertImageData(imageData) : null;

  const [
    hybridHit,
    globalHit,
    wasmHit,
    wasmInvertedHit,
    html5Hit,
    nativeCanvasHit,
    wasmDetectorHit,
  ] = await Promise.all([
    Promise.resolve(decodeWithZxing(imageData, "zxing-hybrid")),
    Promise.resolve(decodeWithZxing(imageData, "zxing-global")),
    decodeWithZxingWasm(imageData, false),
    inverted ? decodeWithZxingWasm(inverted, true) : Promise.resolve(null),
    decodeWithHtml5(fileDecoder, canvas),
    (async () => {
      const detector = getBrowserDetector();
      if (!detector) return null;
      const bitmap = await createImageBitmap(canvas);
      const hit = await decodeWithDetector(detector, "native", bitmap);
      bitmap.close();
      return hit;
    })(),
    (async () => {
      const detector = await getWasmDetector();
      if (!detector) return null;
      return decodeWithDetector(detector, "wasm-detector", canvas);
    })(),
  ]);

  collectHits(hits, seen, [
    hybridHit,
    globalHit,
    wasmHit,
    wasmInvertedHit,
    html5Hit,
    nativeCanvasHit,
    wasmDetectorHit,
  ]);

  if (includeInverted && inverted) {
    collectHits(hits, seen, [
      decodeWithZxing(inverted, "zxing-hybrid"),
      decodeWithZxing(inverted, "zxing-global"),
    ]);
  }

  return hits;
}

export async function decodeBarcodeFromCanvas(
  canvas: HTMLCanvasElement,
  fileDecoder: Html5Qrcode,
  includeInverted = false,
): Promise<BarcodeDecodeHit[]> {
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context || canvas.width < 8 || canvas.height < 8) return [];

  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  return decodeImageData(imageData, fileDecoder, canvas, includeInverted);
}

export async function decodeBarcodeFromVideo(
  video: HTMLVideoElement,
  fileDecoder: Html5Qrcode,
): Promise<BarcodeDecodeHit[]> {
  if (video.videoWidth < 8 || video.videoHeight < 8) return [];

  const hits: BarcodeDecodeHit[] = [];
  const seen = new Set<string>();

  const browserDetector = getBrowserDetector();
  const ponyfillDetector = await getWasmDetector();

  const [nativeVideoHit, wasmVideoHit] = await Promise.all([
    browserDetector
      ? decodeWithDetector(browserDetector, "native", video)
      : Promise.resolve(null),
    ponyfillDetector
      ? decodeWithDetector(ponyfillDetector, "wasm-detector", video)
      : Promise.resolve(null),
  ]);

  collectHits(hits, seen, [nativeVideoHit, wasmVideoHit]);

  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return hits;

  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const canvasHits = await decodeImageData(imageData, fileDecoder, canvas, true);
  for (const hit of canvasHits) {
    const key = `${hit.source}:${hit.code}`;
    if (seen.has(key)) continue;
    seen.add(key);
    hits.push(hit);
  }

  return hits;
}

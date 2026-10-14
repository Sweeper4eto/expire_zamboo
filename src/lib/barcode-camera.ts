import type { Html5Qrcode } from "html5-qrcode";
import { decodeBarcodeFromCanvas, decodeBarcodeFromVideo } from "@/lib/barcode-decode";

type EnhanceMode =
  | "contrast"
  | "highContrast"
  | "sharpen"
  | "strongSharpen"
  | "unsharp"
  | "grayscaleThreshold"
  | "adaptiveThreshold"
  | "localContrast"
  | "invert";

type FrameCapture = {
  cropRatio?: number;
  cropOffsetY?: number;
  scaleX?: number;
  upscale?: number;
  mode: EnhanceMode;
  invertDecode?: boolean;
};

const ENHANCEMENT_PASSES: FrameCapture[] = [
  { mode: "contrast" },
  { cropRatio: 0.9, mode: "unsharp" },
  { cropRatio: 0.72, upscale: 1.8, mode: "strongSharpen" },
  { cropRatio: 0.88, upscale: 1.5, mode: "highContrast" },
  { cropRatio: 0.72, upscale: 2.2, mode: "unsharp" },
  { cropRatio: 0.88, scaleX: 1.24, mode: "sharpen" },
  { cropRatio: 0.88, scaleX: 0.8, mode: "sharpen" },
  { cropRatio: 0.72, mode: "adaptiveThreshold" },
  { cropRatio: 0.88, upscale: 2, mode: "localContrast" },
  { cropRatio: 0.72, upscale: 2.5, mode: "strongSharpen", invertDecode: true },
  { cropRatio: 0.55, cropOffsetY: -0.12, upscale: 2.2, mode: "unsharp" },
  { cropRatio: 0.55, cropOffsetY: 0.12, upscale: 2.2, mode: "unsharp" },
  { cropRatio: 0.72, mode: "grayscaleThreshold" },
  { cropRatio: 0.88, upscale: 1.8, mode: "strongSharpen" },
  { cropRatio: 0.72, mode: "invert", invertDecode: true },
];

const ENHANCED_SCAN_INTERVAL_MS = 180;
const FAST_SCAN_INTERVAL_MS = 90;
const AUTO_REFOCUS_INTERVAL_MS = 2000;
const PASSES_PER_TICK = 4;

function clamp(value: number): number {
  return Math.max(0, Math.min(255, value));
}

function toGrayscale(data: Uint8ClampedArray): Uint8Array {
  const gray = new Uint8Array(data.length / 4);
  for (let index = 0, pixel = 0; index < data.length; index += 4, pixel += 1) {
    gray[pixel] = Math.round(
      data[index] * 0.299 + data[index + 1] * 0.587 + data[index + 2] * 0.114,
    );
  }
  return gray;
}

function boxBlurGray(
  gray: Uint8Array,
  width: number,
  height: number,
): Uint8Array {
  const blurred = new Uint8Array(gray.length);
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      let sum = 0;
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          sum += gray[(y + dy) * width + (x + dx)];
        }
      }
      blurred[y * width + x] = Math.round(sum / 9);
    }
  }
  return blurred;
}

function applySharpenKernel(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  strength: number,
): void {
  const source = new Uint8ClampedArray(data);
  const getGray = (x: number, y: number) => {
    const index = (y * width + x) * 4;
    return (
      source[index] * 0.299 +
      source[index + 1] * 0.587 +
      source[index + 2] * 0.114
    );
  };

  const centerWeight = 1 + strength * 4;

  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const value = clamp(
        getGray(x, y) * centerWeight -
          strength *
            (getGray(x - 1, y) +
              getGray(x + 1, y) +
              getGray(x, y - 1) +
              getGray(x, y + 1)),
      );
      const index = (y * width + x) * 4;
      data[index] = value;
      data[index + 1] = value;
      data[index + 2] = value;
    }
  }
}

function applyUnsharp(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  amount = 2.1,
): void {
  const imageData = context.getImageData(0, 0, width, height);
  const { data } = imageData;
  const gray = toGrayscale(data);
  const blurred = boxBlurGray(gray, width, height);

  for (let index = 0, pixel = 0; index < data.length; index += 4, pixel += 1) {
    const value = clamp(gray[pixel] + amount * (gray[pixel] - blurred[pixel]));
    data[index] = value;
    data[index + 1] = value;
    data[index + 2] = value;
  }

  context.putImageData(imageData, 0, 0);
}

function applyAdaptiveThreshold(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  window = 15,
  bias = 8,
): void {
  const gray = toGrayscale(data);
  const radius = Math.max(2, Math.floor(window / 2));

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let sum = 0;
      let count = 0;
      for (let dy = -radius; dy <= radius; dy += 1) {
        for (let dx = -radius; dx <= radius; dx += 1) {
          const sampleY = Math.min(height - 1, Math.max(0, y + dy));
          const sampleX = Math.min(width - 1, Math.max(0, x + dx));
          sum += gray[sampleY * width + sampleX];
          count += 1;
        }
      }
      const threshold = sum / count - bias;
      const value = gray[y * width + x] > threshold ? 255 : 0;
      const index = (y * width + x) * 4;
      data[index] = value;
      data[index + 1] = value;
      data[index + 2] = value;
    }
  }
}

function applyLocalContrast(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): void {
  const blockSize = 4;
  const blockW = Math.ceil(width / blockSize);
  const blockH = Math.ceil(height / blockSize);

  for (let blockY = 0; blockY < blockH; blockY += 1) {
    for (let blockX = 0; blockX < blockW; blockX += 1) {
      let min = 255;
      let max = 0;
      const startX = blockX * blockSize;
      const startY = blockY * blockSize;
      const endX = Math.min(width, startX + blockSize);
      const endY = Math.min(height, startY + blockSize);

      for (let y = startY; y < endY; y += 1) {
        for (let x = startX; x < endX; x += 1) {
          const index = (y * width + x) * 4;
          const gray = Math.round(
            data[index] * 0.299 +
              data[index + 1] * 0.587 +
              data[index + 2] * 0.114,
          );
          min = Math.min(min, gray);
          max = Math.max(max, gray);
        }
      }

      const range = Math.max(1, max - min);
      for (let y = startY; y < endY; y += 1) {
        for (let x = startX; x < endX; x += 1) {
          const index = (y * width + x) * 4;
          const gray = Math.round(
            data[index] * 0.299 +
              data[index + 1] * 0.587 +
              data[index + 2] * 0.114,
          );
          const value = clamp(Math.round(((gray - min) / range) * 255));
          data[index] = value;
          data[index + 1] = value;
          data[index + 2] = value;
        }
      }
    }
  }
}

function applyEnhancement(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  mode: EnhanceMode,
): void {
  const imageData = context.getImageData(0, 0, width, height);
  const { data } = imageData;

  if (mode === "contrast") {
    const contrast = 1.55;
    const brightness = 8;
    const offset = 128 * (1 - contrast);
    for (let index = 0; index < data.length; index += 4) {
      data[index] = clamp(data[index] * contrast + offset + brightness);
      data[index + 1] = clamp(data[index + 1] * contrast + offset + brightness);
      data[index + 2] = clamp(data[index + 2] * contrast + offset + brightness);
    }
    context.putImageData(imageData, 0, 0);
    return;
  }

  if (mode === "highContrast") {
    const contrast = 2.35;
    const brightness = 14;
    const offset = 128 * (1 - contrast);
    for (let index = 0; index < data.length; index += 4) {
      data[index] = clamp(data[index] * contrast + offset + brightness);
      data[index + 1] = clamp(data[index + 1] * contrast + offset + brightness);
      data[index + 2] = clamp(data[index + 2] * contrast + offset + brightness);
    }
    context.putImageData(imageData, 0, 0);
    return;
  }

  if (mode === "invert") {
    for (let index = 0; index < data.length; index += 4) {
      data[index] = 255 - data[index];
      data[index + 1] = 255 - data[index + 1];
      data[index + 2] = 255 - data[index + 2];
    }
    context.putImageData(imageData, 0, 0);
    return;
  }

  if (mode === "grayscaleThreshold") {
    let sum = 0;
    const gray = new Uint8Array(width * height);
    for (let index = 0, pixel = 0; index < data.length; index += 4, pixel += 1) {
      const value = Math.round(
        data[index] * 0.299 + data[index + 1] * 0.587 + data[index + 2] * 0.114,
      );
      gray[pixel] = value;
      sum += value;
    }
    const threshold = sum / gray.length;
    for (let index = 0, pixel = 0; index < data.length; index += 4, pixel += 1) {
      const value = gray[pixel] > threshold ? 255 : 0;
      data[index] = value;
      data[index + 1] = value;
      data[index + 2] = value;
    }
    context.putImageData(imageData, 0, 0);
    return;
  }

  if (mode === "adaptiveThreshold") {
    applyAdaptiveThreshold(data, width, height);
    context.putImageData(imageData, 0, 0);
    return;
  }

  if (mode === "localContrast") {
    applyLocalContrast(data, width, height);
    context.putImageData(imageData, 0, 0);
    return;
  }

  if (mode === "unsharp") {
    context.putImageData(imageData, 0, 0);
    applyUnsharp(context, width, height);
    return;
  }

  if (mode === "strongSharpen") {
    applySharpenKernel(data, width, height, 1.35);
    context.putImageData(imageData, 0, 0);
    applyUnsharp(context, width, height, 1.6);
    return;
  }

  applySharpenKernel(data, width, height, 1);
  context.putImageData(imageData, 0, 0);
}

function findScannerVideo(containerId: string): HTMLVideoElement | null {
  const container = document.getElementById(containerId);
  return container?.querySelector("video") ?? null;
}

/** Snapshot the live barcode preview as a JPEG data URL (for double-tap direct picture). */
export function captureScannerPreview(containerId: string): string | null {
  const video = findScannerVideo(containerId);
  if (!video || video.videoWidth < 8 || video.videoHeight < 8) return null;

  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const context = canvas.getContext("2d");
  if (!context) return null;

  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  try {
    return canvas.toDataURL("image/jpeg", 0.85);
  } catch {
    return null;
  }
}

function renderVideoFrame(
  context: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  video: HTMLVideoElement,
  capture: FrameCapture,
): { width: number; height: number } | null {
  const cropRatio = capture.cropRatio ?? 1;
  const cropOffsetY = capture.cropOffsetY ?? 0;
  const scaleX = capture.scaleX ?? 1;
  const upscale = capture.upscale ?? 1;
  const sourceWidth = video.videoWidth * cropRatio;
  const sourceHeight = video.videoHeight * cropRatio;
  if (sourceWidth < 8 || sourceHeight < 8) return null;

  const sx = (video.videoWidth - sourceWidth) / 2;
  const sy =
    (video.videoHeight - sourceHeight) / 2 +
    video.videoHeight * cropOffsetY;
  const clampedSy = Math.max(0, Math.min(video.videoHeight - sourceHeight, sy));

  canvas.width = Math.max(1, Math.floor(sourceWidth * scaleX * upscale));
  canvas.height = Math.max(1, Math.floor(sourceHeight * upscale));

  context.imageSmoothingEnabled = upscale <= 1.2;
  context.drawImage(
    video,
    sx,
    clampedSy,
    sourceWidth,
    sourceHeight,
    0,
    0,
    canvas.width,
    canvas.height,
  );

  applyEnhancement(context, canvas.width, canvas.height, capture.mode);
  return { width: canvas.width, height: canvas.height };
}

export async function refocusBarcodeCamera(scanner: Html5Qrcode): Promise<void> {
  try {
    await scanner.applyVideoConstraints({
      advanced: [{ focusMode: "single-shot" }],
    } as unknown as MediaTrackConstraints);
    await new Promise((resolve) => setTimeout(resolve, 280));
    await scanner.applyVideoConstraints({
      advanced: [{ focusMode: "continuous" }],
      focusMode: { ideal: "continuous" },
    } as unknown as MediaTrackConstraints);
  } catch {
    // Focus modes are optional across devices.
  }
}

export async function applyBarcodeCameraConstraints(
  scanner: Html5Qrcode,
): Promise<void> {
  try {
    await scanner.applyVideoConstraints({
      width: { ideal: 1280 },
      height: { ideal: 720 },
      advanced: [{ focusMode: "continuous" }],
    } as unknown as MediaTrackConstraints);
  } catch {
    // Constraint support varies by device/browser.
  }

  try {
    await refocusBarcodeCamera(scanner);
  } catch {
    // Focus nudge is best-effort only.
  }
}

export async function toggleBarcodeTorch(
  scanner: Html5Qrcode,
  enabled: boolean,
): Promise<boolean> {
  try {
    const torch = scanner.getRunningTrackCameraCapabilities().torchFeature();
    if (!torch.isSupported()) return false;
    await torch.apply(enabled);
    return true;
  } catch {
    return false;
  }
}

async function decodeEnhancedPass(
  fileDecoder: Html5Qrcode,
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
  context: CanvasRenderingContext2D,
  capture: FrameCapture,
): Promise<Array<{ code: string; source: string }>> {
  const rendered = renderVideoFrame(context, canvas, video, capture);
  if (!rendered) return [];
  const hits = await decodeBarcodeFromCanvas(
    canvas,
    fileDecoder,
    capture.invertDecode ?? capture.mode === "invert",
  );
  return hits.map((hit) => ({ code: hit.code, source: hit.source }));
}

export async function decodeEnhancedVideoFrame(
  fileDecoder: Html5Qrcode,
  containerId: string,
  startPassIndex = 0,
  passesPerTick = PASSES_PER_TICK,
): Promise<Array<{ code: string; source: string }>> {
  const video = findScannerVideo(containerId);
  if (!video || video.videoWidth < 1 || video.videoHeight < 1) {
    return [];
  }

  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return [];

  const results: Array<{ code: string; source: string }> = [];
  const seen = new Set<string>();

  const passHits = await Promise.all(
    Array.from({ length: passesPerTick }, (_, offset) => {
      const capture =
        ENHANCEMENT_PASSES[(startPassIndex + offset) % ENHANCEMENT_PASSES.length];
      return decodeEnhancedPass(fileDecoder, video, canvas, context, capture);
    }),
  );

  for (const hits of passHits) {
    for (const hit of hits) {
      const key = `${hit.source}:${hit.code}`;
      if (seen.has(key)) continue;
      seen.add(key);
      results.push(hit);
    }
  }

  return results;
}

/** Periodically decode enhanced frames for glass, glare, blur, and partial labels. */
export function startEnhancedAutoScan(
  fileDecoder: Html5Qrcode,
  containerId: string,
  onCandidate: (code: string, source: string) => void,
): () => void {
  let busy = false;
  let passIndex = 0;

  const interval = setInterval(() => {
    if (busy) return;
    busy = true;
    void decodeEnhancedVideoFrame(fileDecoder, containerId, passIndex, PASSES_PER_TICK)
      .then((hits) => {
        for (const hit of hits) {
          onCandidate(hit.code, hit.source);
        }
      })
      .finally(() => {
        passIndex = (passIndex + PASSES_PER_TICK) % ENHANCEMENT_PASSES.length;
        busy = false;
      });
  }, ENHANCED_SCAN_INTERVAL_MS);

  return () => clearInterval(interval);
}

/** High-priority full-resolution scan on raw video frames. */
export function startFastVideoScan(
  fileDecoder: Html5Qrcode,
  containerId: string,
  onCandidate: (code: string, source: string) => void,
): () => void {
  let busy = false;
  let frameId = 0;
  let lastTick = 0;

  const tick = (now: number) => {
    frameId = requestAnimationFrame(tick);
    if (busy || now - lastTick < FAST_SCAN_INTERVAL_MS) return;
    lastTick = now;

    const video = findScannerVideo(containerId);
    if (!video || video.videoWidth < 1 || video.videoHeight < 1) return;

    busy = true;
    void decodeBarcodeFromVideo(video, fileDecoder)
      .then((hits) => {
        for (const hit of hits) {
          onCandidate(hit.code, hit.source);
        }
      })
      .finally(() => {
        busy = false;
      });
  };

  frameId = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(frameId);
}

/** Keep autofocus hunting while the label is hard to read. */
export function startAutoRefocus(
  scanner: Html5Qrcode,
  intervalMs = AUTO_REFOCUS_INTERVAL_MS,
): () => void {
  const interval = setInterval(() => {
    void refocusBarcodeCamera(scanner);
  }, intervalMs);
  return () => clearInterval(interval);
}

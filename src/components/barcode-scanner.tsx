"use client";

import {
  Html5Qrcode,
  Html5QrcodeSupportedFormats,
  type CameraDevice,
  type Html5QrcodeCameraScanConfig,
} from "html5-qrcode";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { PrimaryButton, SecondaryButton } from "@/components/auth-forms";
import { CancelButton } from "@/components/cancel-button";
import { ConfirmButton } from "@/components/confirm-button";
import { CameraIcon } from "@/components/app-nav-icons";
import { appFooterButtonGrid } from "@/lib/app-ui";
import { FlashlightIcon } from "@/components/app-nav-icons";
import { useT } from "@/components/i18n-provider";
import { ScannerViewfinderOverlay } from "@/components/scanner-viewfinder-overlay";
import { startEnhancedAutoScan, startFastVideoScan, toggleBarcodeTorch, applyBarcodeCameraConstraints, startAutoRefocus, captureScannerPreview } from "@/lib/barcode-camera";
import { prepareBarcodeDecoders } from "@/lib/barcode-decode";
import { CrossDecoderBarcodeConsensus, isPlausibleBarcode, normalizeBarcode } from "@/lib/barcode";

type Props = {
  onScan: (barcode: string) => void | Promise<void>;
  onCancel?: () => void;
  /** Start camera as soon as the component mounts (scan pages). */
  autoStart?: boolean;
  /** When false, camera scan fills the barcode field for manual edit before confirm. */
  submitOnScan?: boolean;
  /**
   * Keep scanning after each decode; call `onDetect` so a parent search field
   * can update. UI shows Confirm + Cancel only (no nested barcode input).
   */
  continuousFill?: boolean;
  /** Fired on every accepted decode while `continuousFill` is on. */
  onDetect?: (barcode: string) => void;
  /** Double-tap the preview to continue without a barcode (passes a live photo when possible). */
  onSkipWithoutBarcode?: (photoDataUrl?: string) => void;
};

const PRODUCT_BARCODE_FORMATS = [
  Html5QrcodeSupportedFormats.EAN_13,
  Html5QrcodeSupportedFormats.EAN_8,
  Html5QrcodeSupportedFormats.UPC_A,
  Html5QrcodeSupportedFormats.UPC_E,
  Html5QrcodeSupportedFormats.CODE_128,
  Html5QrcodeSupportedFormats.CODE_39,
  Html5QrcodeSupportedFormats.ITF,
];

const SCAN_CONFIG: Html5QrcodeCameraScanConfig = {
  fps: 12,
  disableFlip: false,
  // Full preview decode — laptop webcams need as many pixels as possible.
  qrbox: (viewfinderWidth, viewfinderHeight) => ({
    width: Math.max(120, Math.floor(viewfinderWidth * 0.98)),
    height: Math.max(100, Math.floor(viewfinderHeight * 0.98)),
  }),
};

const CAMERA_ATTEMPTS: MediaTrackConstraints[] = [
  { facingMode: "environment" },
  { facingMode: { ideal: "environment" } },
  { facingMode: { ideal: "user" } },
  { facingMode: "user" },
  {},
];

const CAMERA_CACHE_KEY = "magazin-barcode-camera-id";

const SCANNER_OPTIONS = {
  verbose: false,
  formatsToSupport: PRODUCT_BARCODE_FORMATS,
  useBarCodeDetectorIfSupported: true,
  experimentalFeatures: {
    useBarCodeDetectorIfSupported: true,
  },
} as const;

function cacheCameraId(cameraId: string): void {
  try {
    sessionStorage.setItem(CAMERA_CACHE_KEY, cameraId);
  } catch {
    // sessionStorage may be unavailable in private mode
  }
}

function readCachedCameraId(): string | null {
  try {
    return sessionStorage.getItem(CAMERA_CACHE_KEY);
  } catch {
    return null;
  }
}

function pickRearCamera(cameras: CameraDevice[]): string | undefined {
  const rear = cameras.find((camera) =>
    /back|rear|environment/i.test(camera.label),
  );
  return rear?.id ?? cameras[0]?.id;
}

async function safeStopScanner(scanner: Html5Qrcode | null | undefined): Promise<void> {
  if (!scanner) return;
  try {
    // Always attempt stop — isScanning can still be false while start() is in-flight.
    await scanner.stop().catch(() => undefined);
  } catch {
    // html5-qrcode may throw synchronously if stop runs before start finishes
  }
}

async function resetScanner(scanner: Html5Qrcode): Promise<void> {
  await safeStopScanner(scanner);
}

async function waitForScannerLayout(containerId: string): Promise<void> {
  for (let attempt = 0; attempt < 24; attempt += 1) {
    const element = document.getElementById(containerId);
    const parent = element?.parentElement;
    if (
      element &&
      parent &&
      parent.offsetWidth > 0 &&
      parent.offsetHeight > 0
    ) {
      return;
    }
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve());
    });
  }
}

async function startScanner(
  scanner: Html5Qrcode,
  fileDecoder: Html5Qrcode,
  containerId: string,
  onDecoded: (value: string) => void | Promise<void>,
  isContinuous: () => boolean,
): Promise<() => void> {
  let lastError: unknown;
  const consensus = new CrossDecoderBarcodeConsensus();
  let stopEnhanced: () => void = () => {};
  let stopFast: () => void = () => {};
  let stopRefocus: () => void = () => {};

  const makeCleanup = () => () => {
    stopEnhanced();
    stopFast();
    stopRefocus();
  };

  const restartEnhancedScan = () => {
    stopEnhanced();
    stopFast();
    stopEnhanced = startEnhancedAutoScan(fileDecoder, containerId, consider);
    stopFast = startFastVideoScan(fileDecoder, containerId, consider);
  };

  const afterCameraStart = () => {
    restartEnhancedScan();
    window.setTimeout(() => {
      if (!scanner.isScanning) return;
      void applyBarcodeCameraConstraints(scanner).catch(() => undefined);
      stopRefocus();
      stopRefocus = startAutoRefocus(scanner);
    }, 400);
    return makeCleanup();
  };

  const deliver = (accepted: string) => {
    void (async () => {
      const continuous = isContinuous();
      if (!continuous) {
        // Stop secondary decoders while we handle this code, but keep the
        // live camera running. `pause(true)` freezes the preview with a
        // "Scanner paused" overlay and we must not leave users stuck there
        // after a soft lookup failure (network / not found stays on page).
        stopEnhanced();
      }
      try {
        await onDecoded(accepted);
        if (continuous) {
          // Allow the next barcode (or a re-read) without waiting on stale consensus.
          consensus.reset();
          return;
        }
        consensus.reset();
        try {
          if (scanner.isScanning) {
            restartEnhancedScan();
          }
        } catch {
          // ignore enhanced restart failures
        }
      } catch {
        consensus.reset();
        try {
          scanner.resume();
        } catch {
          // ignore resume failures during camera startup
        }
        restartEnhancedScan();
      }
    })();
  };

  let lastContinuousCode = "";
  let lastContinuousAt = 0;

  const consider = (decoded: string, source = "live") => {
    // List search mode: fill as soon as we get one plausible read.
    // Full scan flows keep the stricter multi-hit consensus.
    if (isContinuous()) {
      const code = normalizeBarcode(decoded);
      if (!isPlausibleBarcode(code)) return;
      const now = Date.now();
      // Avoid spamming the same code every frame; still allow a new code immediately.
      if (code === lastContinuousCode && now - lastContinuousAt < 900) return;
      lastContinuousCode = code;
      lastContinuousAt = now;
      deliver(code);
      return;
    }

    const accepted = consensus.addFromSource(decoded, source);
    if (accepted) deliver(accepted);
  };

  const onScanSuccess = (decoded: string) => consider(decoded, "live");

  await waitForScannerLayout(containerId);

  const cachedCameraId = readCachedCameraId();
  if (cachedCameraId) {
    try {
      await scanner.start(cachedCameraId, SCAN_CONFIG, onScanSuccess, () => undefined);
      return afterCameraStart();
    } catch (error) {
      lastError = error;
      await resetScanner(scanner);
      try {
        sessionStorage.removeItem(CAMERA_CACHE_KEY);
      } catch {
        // ignore
      }
    }
  }

  for (const camera of CAMERA_ATTEMPTS) {
    try {
      await scanner.start(camera, SCAN_CONFIG, onScanSuccess, () => undefined);
      return afterCameraStart();
    } catch (error) {
      lastError = error;
      await resetScanner(scanner);
    }
  }

  try {
    const cameras = await Html5Qrcode.getCameras();
    const rearId = cameras.length ? pickRearCamera(cameras) : undefined;
    const cameraIds = rearId
      ? [rearId, ...cameras.filter((camera) => camera.id !== rearId).map((c) => c.id)]
      : cameras.map((camera) => camera.id);

    for (const cameraId of cameraIds) {
      try {
        await scanner.start(cameraId, SCAN_CONFIG, onScanSuccess, () => undefined);
        cacheCameraId(cameraId);
        return afterCameraStart();
      } catch (error) {
        lastError = error;
        await resetScanner(scanner);
      }
    }
  } catch {
    // getCameras can fail before permission on some browsers
  }

  throw lastError ?? new Error("CAMERA_UNAVAILABLE");
}

function scannerErrorKey(
  error: unknown,
):
  | "scanner.permissionDenied"
  | "scanner.insecureContext"
  | "scanner.noCamera"
  | "scanner.cameraBusy"
  | "scanner.cameraUnavailable" {
  if (typeof window !== "undefined" && !window.isSecureContext) {
    return "scanner.insecureContext";
  }

  const name = error instanceof Error ? error.name : "";
  const message =
    error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();

  if (
    name === "NotAllowedError" ||
    message.includes("permission") ||
    message.includes("camera_permission_failed")
  ) {
    return "scanner.permissionDenied";
  }
  if (
    name === "NotFoundError" &&
    !message.includes("element") &&
    !message.includes("scanner_element")
  ) {
    return "scanner.noCamera";
  }
  if (
    name === "NotReadableError" ||
    message.includes("could not start video source") ||
    message.includes("trackstarterror") ||
    message.includes("device in use") ||
    message.includes("notreadableerror")
  ) {
    return "scanner.cameraBusy";
  }
  if (message.includes("requested device not found") || message.includes("no camera")) {
    return "scanner.noCamera";
  }
  return "scanner.cameraUnavailable";
}

export function BarcodeScanner({
  onScan,
  onCancel,
  autoStart = false,
  submitOnScan = false,
  continuousFill = false,
  onDetect,
  onSkipWithoutBarcode,
}: Props) {
  const { t } = useT();
  const elementId = useId().replace(/:/g, "");
  const fileDecoderId = `${elementId}-decoder`;
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const fileDecoderRef = useRef<Html5Qrcode | null>(null);
  const scanCleanupRef = useRef<(() => void) | null>(null);
  const onScanRef = useRef(onScan);
  const onDetectRef = useRef(onDetect);
  const submitOnScanRef = useRef(submitOnScan);
  const continuousFillRef = useRef(continuousFill);
  const lastTapRef = useRef(0);
  const handledRef = useRef(false);
  const abortedRef = useRef(false);
  const [manual, setManual] = useState("");
  const [error, setError] = useState("");
  const [scanning, setScanning] = useState(false);
  const [starting, setStarting] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [torchAvailable, setTorchAvailable] = useState(false);

  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  useEffect(() => {
    onDetectRef.current = onDetect;
  }, [onDetect]);

  useEffect(() => {
    submitOnScanRef.current = submitOnScan;
  }, [submitOnScan]);

  useEffect(() => {
    continuousFillRef.current = continuousFill;
  }, [continuousFill]);

  useEffect(() => {
    if (typeof window === "undefined" || !window.isSecureContext) return;

    abortedRef.current = false;

    const stopCamera = () => {
      abortedRef.current = true;
      scanCleanupRef.current?.();
      scanCleanupRef.current = null;
      const scanner = scannerRef.current;
      void safeStopScanner(scanner).finally(() => {
        if (scannerRef.current === scanner) {
          scannerRef.current = null;
        }
      });
      fileDecoderRef.current?.clear();
      fileDecoderRef.current = null;
    };

    const onPageHide = () => {
      stopCamera();
    };

    window.addEventListener("pagehide", onPageHide);

    return () => {
      window.removeEventListener("pagehide", onPageHide);
      stopCamera();
    };
  }, []);

  const deliverBarcode = useCallback(async (value: string) => {
    const barcode = normalizeBarcode(value);
    if (!barcode) {
      return;
    }

    if (continuousFillRef.current) {
      setManual(barcode);
      onDetectRef.current?.(barcode);
      return;
    }

    if (!submitOnScanRef.current) {
      setManual(barcode);
      handledRef.current = false;
      try {
        scannerRef.current?.resume();
      } catch {
        // Scanner may not be running yet while the camera is still starting.
      }
      return;
    }

    if (handledRef.current) return;
    handledRef.current = true;
    setManual(barcode);
    try {
      await onScanRef.current(barcode);
    } finally {
      // Allow another scan if we stayed on this screen (e.g. lookup error).
      handledRef.current = false;
    }
  }, []);

  const startCamera = useCallback(async () => {
    if (starting || scanning) return;

    if (typeof window !== "undefined" && !window.isSecureContext) {
      setError(t("scanner.insecureContext"));
      return;
    }

    abortedRef.current = false;
    handledRef.current = false;
    setStarting(true);
    setError("");
    setScanning(true);
    setTorchOn(false);
    scanCleanupRef.current?.();
    scanCleanupRef.current = null;

    try {
      if (scannerRef.current) {
        await resetScanner(scannerRef.current);
        scannerRef.current = null;
      }
      if (fileDecoderRef.current) {
        fileDecoderRef.current.clear();
        fileDecoderRef.current = null;
      }

      await waitForScannerLayout(elementId);

      if (abortedRef.current) {
        setScanning(false);
        return;
      }

      await prepareBarcodeDecoders();

      if (abortedRef.current) {
        setScanning(false);
        return;
      }

      const scanner = new Html5Qrcode(elementId, SCANNER_OPTIONS);
      const fileDecoder = new Html5Qrcode(fileDecoderId, SCANNER_OPTIONS);
      scannerRef.current = scanner;
      fileDecoderRef.current = fileDecoder;

      scanCleanupRef.current = await startScanner(
        scanner,
        fileDecoder,
        elementId,
        deliverBarcode,
        () => continuousFillRef.current,
      );

      if (abortedRef.current) {
        scanCleanupRef.current?.();
        scanCleanupRef.current = null;
        await resetScanner(scanner);
        if (scannerRef.current === scanner) {
          scannerRef.current = null;
        }
        fileDecoder.clear();
        if (fileDecoderRef.current === fileDecoder) {
          fileDecoderRef.current = null;
        }
        setScanning(false);
        setStarting(false);
        return;
      }

      try {
        const torch = scanner.getRunningTrackCameraCapabilities().torchFeature();
        setTorchAvailable(torch.isSupported());
      } catch {
        setTorchAvailable(false);
      }
    } catch (caught) {
      if (!abortedRef.current) {
        setScanning(false);
        setError(t(scannerErrorKey(caught)));
      }
    } finally {
      setStarting(false);
    }
  }, [deliverBarcode, elementId, fileDecoderId, scanning, starting, t]);

  useEffect(() => {
    if (!autoStart) return;
    void startCamera();
    // Only auto-start once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart]);

  const onTorchToggle = useCallback(async () => {
    if (!scannerRef.current) return;
    const next = !torchOn;
    const applied = await toggleBarcodeTorch(scannerRef.current, next);
    if (applied) setTorchOn(next);
  }, [torchOn]);

  async function confirmManual() {
    const barcode = normalizeBarcode(manual);
    if (!barcode) return;
    try {
      await onScanRef.current(barcode);
    } catch {
      // Scan handlers must not throw; guard the app shell if one does.
    }
  }

  const hasBarcode = Boolean(normalizeBarcode(manual));

  return (
    <div className="space-y-3">
      <div
        className={
          scanning || starting
            ? "barcode-scanner-view relative overflow-hidden rounded-xl border border-card-border"
            : "h-0 overflow-hidden"
        }
        style={
          onSkipWithoutBarcode && (scanning || starting)
            ? { touchAction: "manipulation" }
            : undefined
        }
        onPointerUp={(event) => {
          if (!onSkipWithoutBarcode || !(scanning || starting)) return;
          if (event.pointerType === "mouse" && event.button !== 0) return;
          const now = Date.now();
          if (now - lastTapRef.current < 350) {
            lastTapRef.current = 0;
            const photo = captureScannerPreview(elementId) ?? undefined;
            onSkipWithoutBarcode(photo);
            return;
          }
          lastTapRef.current = now;
        }}
      >
        <div id={elementId} className="w-full max-w-full" />
        {scanning || starting ? <ScannerViewfinderOverlay /> : null}
        {scanning && torchAvailable ? (
          <button
            type="button"
            className={`absolute right-2.5 bottom-2.5 z-10 flex size-9 items-center justify-center rounded-full border border-white/25 bg-black/55 text-white backdrop-blur-sm ${
              torchOn ? "bg-primary/90 text-primary-fg border-primary" : ""
            }`}
            onClick={(event) => {
              event.stopPropagation();
              void onTorchToggle();
            }}
            aria-label={torchOn ? t("scanner.torchOff") : t("scanner.torchOn")}
            title={torchOn ? t("scanner.torchOff") : t("scanner.torchOn")}
          >
            <FlashlightIcon className="size-4" />
          </button>
        ) : null}
      </div>
      <div id={fileDecoderId} className="hidden" aria-hidden />
      {scanning && !continuousFill ? (
        <div className="space-y-0.5 text-center text-[11px] leading-snug text-muted">
          <p>{starting ? t("scanner.starting") : t("scanner.tips")}</p>
          {onSkipWithoutBarcode && !starting ? (
            <p>{t("scanner.doubleTapHint")}</p>
          ) : null}
        </div>
      ) : null}
      {!scanning ? (
        <PrimaryButton
          onClick={() => void startCamera()}
          disabled={starting}
          icon={<CameraIcon className="size-4 shrink-0" />}
        >
          {starting ? t("scanner.starting") : t("scanner.startCamera")}
        </PrimaryButton>
      ) : !continuousFill && torchAvailable ? (
        <SecondaryButton
          onClick={() => void onTorchToggle()}
          icon={<FlashlightIcon className="size-4 shrink-0" />}
        >
          {torchOn ? t("scanner.torchOff") : t("scanner.torchOn")}
        </SecondaryButton>
      ) : null}
      {error ? <p className="text-sm text-warning-fg">{error}</p> : null}

      {continuousFill ? (
        <div className={appFooterButtonGrid}>
          {onCancel ? (
            <CancelButton fullWidth={false} onClick={onCancel}>
              {t("common.cancel")}
            </CancelButton>
          ) : null}
          <ConfirmButton
            fullWidth={false}
            data-testid="scanner-confirm-barcode"
            disabled={!hasBarcode}
            onClick={() => void confirmManual()}
          >
            {t("scanner.confirm")}
          </ConfirmButton>
        </div>
      ) : (
        <>
          <label className="block text-sm font-medium text-foreground">
            {t("common.barcode")}
            <input
              data-testid="barcode-manual-input"
              className="mt-1 w-full min-w-0 rounded-xl border border-input-border bg-input px-3 py-3 text-base text-foreground"
              placeholder={t("scanner.manualPlaceholder")}
              value={manual}
              onChange={(event) => setManual(event.target.value)}
            />
          </label>
          {onCancel ? (
            <CancelButton onClick={onCancel}>{t("common.cancel")}</CancelButton>
          ) : null}
          <ConfirmButton
            data-testid="scanner-confirm-barcode"
            disabled={!hasBarcode}
            onClick={() => void confirmManual()}
          >
            {t("scanner.confirmBarcode")}
          </ConfirmButton>
        </>
      )}
    </div>
  );
}

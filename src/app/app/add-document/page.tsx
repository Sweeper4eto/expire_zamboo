"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import {
  DocumentNavIcon,
  ExpiryNavIcon,
  MergedItemsStatIcon,
  NewItemsStatIcon,
  RefreshIcon,
} from "@/components/app-nav-icons";
import { CameraCapture, prepareDocumentImage } from "@/components/camera-capture";
import { assessDocumentPhotoQuality } from "@/lib/document-image";
import { DocumentDraftDetailSheet } from "@/components/document-draft-detail-sheet";
import { DocumentDraftListCard } from "@/components/document-draft-list-card";
import { DocumentProcessingPanel } from "@/components/document-processing-panel";
import { LoadingSpinnerBlock } from "@/components/loading-spinner";
import { MobilePageHeader, listPageChromeClassName } from "@/components/mobile-page-header";
import { RemoveConfirmDialog } from "@/components/remove-confirm-dialog";
import { SearchField } from "@/components/search-field";
import { useT } from "@/components/i18n-provider";
import { useAppSession } from "@/components/app-session-provider";
import { navigateApp } from "@/lib/app-navigation";
import {
  appButtonCancelFull,
  appButtonPrimaryFull,
  appButtonNeutralFull,
  appFooterButtonGrid,
  appListInset,
  appSearchInput,
  appStatIconWrap,
} from "@/lib/app-ui";
import { useBrowserBackStack } from "@/lib/browser-back";
import {
  type DocumentDraftItem,
  draftItemValid,
  draftMatchesSearch,
  draftMissingExpiry,
} from "@/lib/document-draft";

/** Full-height review shell — no horizontal pad (content uses appListInset). */
const reviewPageShellClassName =
  "mx-auto flex h-[calc(100svh-var(--app-bottom-nav-frame)-env(safe-area-inset-bottom,0px))] min-h-0 w-full max-w-lg flex-col overflow-x-visible pt-1";

type Step = "camera" | "processing" | "review" | "done";

type ImportResult = { created: number; merged: number };
type SessionTotals = { scans: number; created: number; merged: number };

function newKey() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function AddDocumentContent() {
  const { t } = useT();
  const router = useRouter();
  const { ready, user } = useAppSession();
  const searchParams = useSearchParams();
  const storeId = searchParams.get("storeId") ?? "";
  const [checking, setChecking] = useState(true);
  const [step, setStep] = useState<Step>("camera");
  const [cameraSession, setCameraSession] = useState(0);
  const [items, setItems] = useState<DocumentDraftItem[]>([]);
  const [error, setError] = useState("");
  const [importing, setImporting] = useState(false);
  const [search, setSearch] = useState("");
  const [detailKey, setDetailKey] = useState<string | null>(null);
  const [removeKey, setRemoveKey] = useState<string | null>(null);
  const [confirmRemoveNoExpiry, setConfirmRemoveNoExpiry] = useState(false);
  const [lastResult, setLastResult] = useState<ImportResult | null>(null);
  const [sessionTotals, setSessionTotals] = useState<SessionTotals>({
    scans: 0,
    created: 0,
    merged: 0,
  });
  const [processingProgress, setProcessingProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);
  const [failedFiles, setFailedFiles] = useState<string[]>([]);

  const detailItem = useMemo(
    () => items.find((item) => item.key === detailKey) ?? null,
    [detailKey, items],
  );

  const confirmRemoveItem = useMemo(
    () => items.find((item) => item.key === removeKey) ?? null,
    [removeKey, items],
  );

  useBrowserBackStack([
    {
      id: "draft-detail",
      open: detailKey !== null,
      close: () => setDetailKey(null),
    },
    {
      id: "draft-remove",
      open: removeKey !== null,
      close: () => setRemoveKey(null),
    },
    {
      id: "draft-remove-no-expiry",
      open: confirmRemoveNoExpiry,
      close: () => setConfirmRemoveNoExpiry(false),
    },
  ]);

  useEffect(() => {
    if (!ready) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (user.homeUser) {
      router.replace(
        storeId
          ? `/app/expiry?storeId=${encodeURIComponent(storeId)}`
          : "/app",
      );
      return;
    }
    setChecking(false);
  }, [ready, user, router, storeId]);

  type ParsedItem = {
    name?: string;
    barcode?: string | null;
    articul?: string | null;
    expiryYmd?: string | null;
    quantity?: number;
    productId?: string | null;
    productImagePath?: string | null;
    matchSource?: "barcode" | "name" | "articul" | null;
    zambooGid?: string | null;
    zambooName?: string | null;
    zambooCode?: string | null;
    zambooMatch?: "barcode" | "code" | "name" | "ai" | "fuzzy" | null;
    zambooConfidence?: "high" | "medium" | "low" | null;
  };

  type ProcessResult =
    | { ok: true; items: ParsedItem[] }
    | { ok: false; error: string; retryable?: boolean };

  async function parseDocument(dataUrl: string, attempt = 0): Promise<Response> {
    return fetch("/api/documents/parse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ storeId, dataUrl }),
    }).then(async (response) => {
      if (
        attempt < 1 &&
        (response.status === 502 || response.status === 503 || response.status === 504)
      ) {
        await new Promise((resolve) => setTimeout(resolve, 3000));
        return parseDocument(dataUrl, attempt + 1);
      }
      return response;
    });
  }

  function toDraftItems(items: ParsedItem[]): DocumentDraftItem[] {
    return items.map((item) => ({
      key: newKey(),
      name: item.name ?? "",
      barcode: item.barcode ?? "",
      articul: item.articul ?? "",
      expiryYmd: item.expiryYmd ?? "",
      quantity: String(item.quantity && item.quantity >= 1 ? item.quantity : 1),
      productId: item.productId ?? null,
      productImagePath: item.productImagePath ?? null,
      matchSource: item.matchSource ?? null,
      zambooGid: item.zambooGid ?? null,
      zambooName: item.zambooName ?? null,
      zambooCode: item.zambooCode ?? null,
      zambooMatch: item.zambooMatch ?? null,
      zambooConfidence: item.zambooConfidence ?? null,
    }));
  }

  /**
   * Never throws — network/parse failures are converted into a ProcessResult
   * so callers (including the retry wrapper) don't need their own try/catch.
   */
  async function processDocumentImage(dataUrl: string): Promise<ProcessResult> {
    try {
      // Local design/testing uses OCR mocks — don't block on photo quality.
      if (process.env.NODE_ENV === "production") {
        const quality = await assessDocumentPhotoQuality(dataUrl);
        if (!quality.ok) {
          const key =
            quality.reason === "blurry"
              ? "errors.documentPhotoBlurry"
              : quality.reason === "glare"
                ? "errors.documentPhotoGlare"
                : quality.reason === "tooDark"
                  ? "errors.documentPhotoTooDark"
                  : "errors.documentPhotoTooSmall";
          // Deterministic result of the same image — retrying won't help.
          return { ok: false, error: t(key), retryable: false };
        }
      }

      const prepared = await prepareDocumentImage(dataUrl);
      const response = await parseDocument(prepared);
      if (response.status === 413) {
        return { ok: false, error: t("errors.documentTooLarge"), retryable: false };
      }
      if (response.status === 504) {
        return { ok: false, error: t("errors.documentTimeout") };
      }

      const rawText = await response.text();
      let data: { error?: string; items?: ParsedItem[] } | null = null;
      try {
        data = JSON.parse(rawText) as { error?: string; items?: ParsedItem[] };
      } catch {
        return {
          ok: false,
          error:
            response.ok
              ? t("errors.documentParseFailed")
              : response.status === 502 || response.status === 503
                ? t("errors.documentTimeout")
                : t("errors.documentParseFailed"),
        };
      }
      if (!response.ok || !data?.items) {
        return {
          ok: false,
          error:
            typeof data?.error === "string" && data.error
              ? data.error
              : t("errors.documentParseFailed"),
        };
      }
      return { ok: true, items: data.items };
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      // Proxy/browser often drops the socket while the server is still cascading
      // Gemini models after free-tier 429s — surface a timeout, not "Failed to fetch".
      if (/failed to fetch|networkerror|load failed/i.test(message)) {
        return { ok: false, error: t("errors.documentTimeout") };
      }
      return { ok: false, error: message || t("errors.documentParseFailed") };
    }
  }

  /** Retries once when the failure could plausibly be transient (network/AI hiccup). */
  async function processDocumentImageWithRetry(dataUrl: string): Promise<ProcessResult> {
    const first = await processDocumentImage(dataUrl);
    if (first.ok || first.retryable === false) return first;
    return processDocumentImage(dataUrl);
  }

  async function onCapture(dataUrl: string) {
    if (!storeId) return;
    setError("");
    setFailedFiles([]);
    setStep("processing");
    setProcessingProgress(null);
    const result = await processDocumentImageWithRetry(dataUrl);
    if (!result.ok) {
      setError(result.error);
      setStep("camera");
      return;
    }
    setItems(toDraftItems(result.items));
    setSearch("");
    setStep("review");
  }

  async function onMultipleCapture(
    pages: { dataUrl: string; name: string }[],
  ) {
    if (!storeId || pages.length === 0) return;
    setError("");
    setFailedFiles([]);
    setStep("processing");
    const collected: DocumentDraftItem[] = [];
    let failed = 0;
    for (let index = 0; index < pages.length; index += 1) {
      setProcessingProgress({ current: index + 1, total: pages.length });
      const page = pages[index];
      const label =
        page.name.trim() ||
        t("addDocument.pageLabel", { n: index + 1 });
      const result = await processDocumentImageWithRetry(page.dataUrl);
      if (result.ok) {
        collected.push(...toDraftItems(result.items));
      } else {
        failed += 1;
        setFailedFiles((current) => [...current, label]);
      }
    }
    setProcessingProgress(null);

    if (collected.length === 0) {
      setError(t("errors.documentParseFailed"));
      setStep("camera");
      setFailedFiles([]);
      return;
    }

    setItems(collected);
    setSearch("");
    setStep("review");
    setFailedFiles([]);
    if (failed > 0) {
      setError(
        t("addDocument.multiPartialFailure", {
          failed,
          total: pages.length,
        }),
      );
    }
  }

  function updateItem(key: string, patch: Partial<DocumentDraftItem>) {
    setItems((current) =>
      current.map((item) => (item.key === key ? { ...item, ...patch } : item)),
    );
  }

  function removeItem(key: string) {
    setItems((current) => current.filter((item) => item.key !== key));
    setRemoveKey(null);
    if (detailKey === key) setDetailKey(null);
  }

  function removeItemsWithoutExpiry() {
    const kept = items.filter((item) => !draftMissingExpiry(item));
    setItems(kept);
    if (detailKey && !kept.some((item) => item.key === detailKey)) {
      setDetailKey(null);
    }
    setConfirmRemoveNoExpiry(false);
  }

  const filteredItems = useMemo(
    () => items.filter((item) => draftMatchesSearch(item, search)),
    [items, search],
  );

  const noExpiryCount = useMemo(
    () => items.filter((item) => draftMissingExpiry(item)).length,
    [items],
  );

  const canImport =
    items.length > 0 && items.every((item) => draftItemValid(item));

  async function confirmImport() {
    if (!canImport || !storeId || importing) return;
    setImporting(true);
    setError("");
    try {
      const response = await fetch("/api/documents/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeId,
          items: items.map((item) => ({
            name: item.name.trim(),
            barcode: item.barcode.trim() || null,
            articul: item.articul.trim() || null,
            expiryYmd: item.expiryYmd,
            quantity: Number(item.quantity),
            productId: item.productId,
          })),
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setError(data?.error ?? t("errors.saveFailed"));
        return;
      }
      const created = Number(data?.created ?? 0);
      const merged = Number(data?.merged ?? 0);
      setLastResult({ created, merged });
      setSessionTotals((totals) => ({
        scans: totals.scans + 1,
        created: totals.created + created,
        merged: totals.merged + merged,
      }));
      setItems([]);
      setSearch("");
      setDetailKey(null);
      setStep("done");
    } catch {
      setError(t("errors.saveFailed"));
    } finally {
      setImporting(false);
    }
  }

  const isReviewStep = step === "review";

  if (checking) {
    return (
      <div className="mx-auto min-w-0 max-w-lg overflow-x-visible px-4 pb-6 pt-1">
        <MobilePageHeader title={t("addDocument.title")} sticky />
        <LoadingSpinnerBlock wrapperClassName="flex justify-center py-6" />
      </div>
    );
  }

  return (
    <>
      <div
        className={
          isReviewStep
            ? reviewPageShellClassName
            : "mx-auto min-w-0 max-w-lg overflow-x-visible px-4 pb-5 pt-1"
        }
      >
        {!isReviewStep ? (
          <MobilePageHeader
            title={
              step === "processing" || step === "done"
                ? undefined
                : t("addDocument.title")
            }
            sticky
          />
        ) : null}

      {step === "camera" ? (
        <div className="space-y-3">
          {error ? <p className="text-sm text-error">{error}</p> : null}
          <CameraCapture
            variant="document"
            autoStart
            allowFileUpload
            allowMultipleFiles
            showViewfinder
            onCapture={(dataUrl) => void onCapture(dataUrl)}
            onMultipleCapture={(pages) => void onMultipleCapture(pages)}
            onNewDocument={() => {
              setError("");
              // CameraCapture retakes in place (keeps MediaStream). Only remount
              // if the child could not reuse a live stream.
              setCameraSession((n) => n + 1);
            }}
            onCancel={() => navigateApp("/app")}
            key={cameraSession}
          />
        </div>
      ) : null}

      {step === "processing" ? (
        <DocumentProcessingPanel
          current={processingProgress?.current}
          total={processingProgress?.total}
          failedFiles={failedFiles}
        />
      ) : null}

      {step === "review" ? (
        <>
          <div className={`${listPageChromeClassName} ${appListInset}`}>
            <MobilePageHeader className="mb-0 border-0 pb-0" />
          </div>

          <div className={`min-h-0 flex-1 overflow-y-auto overscroll-y-contain ${appListInset} pb-3 pt-3 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:w-0 [&::-webkit-scrollbar]:h-0`}>
            <div className="space-y-3">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className="text-2xl font-semibold text-foreground">
                      {t("addDocument.reviewTitle")}
                    </h2>
                    <span className="inline-flex min-w-7 items-center justify-center rounded-full bg-primary px-2 py-0.5 text-sm font-bold tabular-nums text-primary-fg">
                      {items.length}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-muted">
                    {t("addDocument.reviewHint")}
                  </p>
                </div>
              </div>
              {error ? <p className="text-sm text-error">{error}</p> : null}

              <div className="flex items-center gap-1.5">
                <SearchField
                  value={search}
                  onChange={setSearch}
                  placeholder={t("addDocument.searchPlaceholder")}
                  aria-label={t("addDocument.searchPlaceholder")}
                  inputClassName={appSearchInput}
                />
                <button
                  type="button"
                  disabled={noExpiryCount === 0}
                  onClick={() => setConfirmRemoveNoExpiry(true)}
                  title={t("addDocument.removeNoExpiryHint", { count: noExpiryCount })}
                  aria-label={t("addDocument.removeNoExpiryHint", { count: noExpiryCount })}
                  className="flex h-9 shrink-0 items-center justify-center gap-1 rounded-lg border border-primary/50 bg-transparent px-2 text-[10px] font-medium leading-none text-primary disabled:opacity-40"
                >
                  {t("addDocument.removeNoExpiry")}
                  {noExpiryCount > 0 ? (
                    <span className="tabular-nums">({noExpiryCount})</span>
                  ) : null}
                </button>
              </div>
            </div>

            <div className="space-y-1.5 pt-3">
              {filteredItems.length === 0 ? (
                <p className="rounded-xl bg-transparent p-4 text-sm text-muted">
                  {items.length === 0
                    ? t("addDocument.emptyReview")
                    : t("addDocument.noResults")}
                </p>
              ) : null}
              {filteredItems.map((item) => (
                <DocumentDraftListCard
                  key={item.key}
                  item={item}
                  onOpen={() => setDetailKey(item.key)}
                  onRemove={() => setRemoveKey(item.key)}
                />
              ))}
            </div>
          </div>

          <div
            className={`shrink-0 ${appListInset} border-t border-card-border bg-background pt-3 pb-2 ${appFooterButtonGrid}`}
          >
            <button
              type="button"
              className={appButtonCancelFull}
              onClick={() => {
                setItems([]);
                setSearch("");
                setDetailKey(null);
                setError("");
                setStep("camera");
              }}
            >
              <RefreshIcon className="size-4 shrink-0" />
              {t("addDocument.retake")}
            </button>
            <button
              type="button"
              disabled={!canImport || importing}
              className={`${appButtonPrimaryFull} disabled:opacity-50`}
              onClick={() => void confirmImport()}
            >
              {!importing ? (
                <ExpiryNavIcon className="size-4 shrink-0" />
              ) : null}
              {importing ? t("addDocument.importing") : t("addDocument.confirmImport")}
            </button>
          </div>
        </>
      ) : null}

      {step === "done" ? (
        <div className="space-y-4 pb-2 pt-1">
          <div className="text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/landing/brand-mark.png?v=3"
              alt=""
              width={96}
              height={96}
              decoding="async"
              className="mx-auto size-24 object-contain"
            />
            <h2 className="mt-4 text-2xl font-semibold text-foreground">
              {t("addDocument.doneTitle")}
            </h2>
            <p className="mx-auto mt-1.5 max-w-xs text-sm leading-snug text-muted">
              {t("addDocument.doneHint")}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-2xl border border-card-border p-2.5">
              <div className="flex items-center gap-2">
                <div className={appStatIconWrap}>
                  <NewItemsStatIcon className="size-3.5" />
                </div>
                <p className="text-3xl font-bold leading-none tabular-nums text-primary">
                  {lastResult?.created ?? 0}
                </p>
              </div>
              <p className="mt-2 text-sm font-semibold leading-tight text-foreground">
                {t("addDocument.newLabel")}
              </p>
              <p className="mt-0.5 text-[11px] leading-snug text-muted">
                {t("addDocument.newHint")}
              </p>
            </div>
            <div className="rounded-2xl border border-card-border p-2.5">
              <div className="flex items-center gap-2">
                <div className={appStatIconWrap}>
                  <MergedItemsStatIcon className="size-3.5" />
                </div>
                <p className="text-3xl font-bold leading-none tabular-nums text-primary">
                  {lastResult?.merged ?? 0}
                </p>
              </div>
              <p className="mt-2 text-sm font-semibold leading-tight text-foreground">
                {t("addDocument.mergedLabel")}
              </p>
              <p className="mt-0.5 text-[11px] leading-snug text-muted">
                {t("addDocument.mergedHint")}
              </p>
            </div>
          </div>

          {sessionTotals.scans > 1 ? (
            <div className="rounded-2xl border border-card-border p-4">
              <p className="text-sm font-semibold text-foreground">
                {t("addDocument.doneSessionTitle", { scans: sessionTotals.scans })}
              </p>
              <p className="mt-1 text-sm text-muted">
                {t("addDocument.doneSessionAdded", { count: sessionTotals.created })}
              </p>
              <p className="text-sm text-muted">
                {t("addDocument.doneSessionMerged", { count: sessionTotals.merged })}
              </p>
            </div>
          ) : null}

          <div className="space-y-2">
            <button
              type="button"
              className={appButtonPrimaryFull}
              onClick={() => {
                setStep("camera");
                setCameraSession((n) => n + 1);
              }}
            >
              <DocumentNavIcon className="size-4" />
              {t("addDocument.scanAnother")}
            </button>
            <button
              type="button"
              className={appButtonNeutralFull}
              onClick={() =>
                router.push(`/app/expiry?storeId=${encodeURIComponent(storeId)}`)
              }
            >
              <ExpiryNavIcon className="size-4 text-primary" />
              {t("addDocument.goToExpiry")}
            </button>
          </div>
        </div>
      ) : null}
      </div>

      {detailItem ? (
        <DocumentDraftDetailSheet
          item={detailItem}
          onClose={() => setDetailKey(null)}
          onSave={(patch) => updateItem(detailItem.key, patch)}
        />
      ) : null}

      {removeKey && confirmRemoveItem ? (
        <RemoveConfirmDialog
          title={t("addDocument.confirmTitle")}
          message={t("addDocument.confirmMessage")}
          itemLabel={`${confirmRemoveItem.name.trim() || t("common.noName")} (${confirmRemoveItem.quantity} ${t("expiry.pieces")})`}
          cancelLabel={t("expiry.confirmCancel")}
          removeLabel={t("expiry.remove")}
          onCancel={() => setRemoveKey(null)}
          onConfirm={() => removeItem(removeKey)}
        />
      ) : null}
      {confirmRemoveNoExpiry ? (
        <RemoveConfirmDialog
          title={t("addDocument.removeNoExpiryTitle")}
          message={t("addDocument.removeNoExpiryMessage")}
          itemLabel={
            noExpiryCount === 1
              ? t("addDocument.removeNoExpiryItemLabelOne")
              : t("addDocument.removeNoExpiryItemLabel", {
                  count: noExpiryCount,
                })
          }
          cancelLabel={t("expiry.confirmCancel")}
          removeLabel={t("expiry.remove")}
          onCancel={() => setConfirmRemoveNoExpiry(false)}
          onConfirm={removeItemsWithoutExpiry}
        />
      ) : null}
    </>
  );
}

export default function AddDocumentPage() {
  return (
    <Suspense>
      <AddDocumentContent />
    </Suspense>
  );
}

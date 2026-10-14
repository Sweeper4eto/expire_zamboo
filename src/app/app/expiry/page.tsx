"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { BarcodeScanner } from "@/components/barcode-scanner";
import { ScanNavIcon } from "@/components/app-nav-icons";
import { ExpiryListCard } from "@/components/expiry-list-card";
import {
  ExpiryEntryDetailSheet,
  type ExpiryDetailEntry,
} from "@/components/expiry-entry-detail-sheet";
import { ExpiryPeriodFilter } from "@/components/expiry-period-filter";
import { ActionFlash } from "@/components/action-flash";
import { MobilePageHeader, listPageChromeClassName } from "@/components/mobile-page-header";
import {
  DEFAULT_DISCOUNT_PERCENT,
  DiscountPercentPicker,
} from "@/components/discount-percent-picker";
import { LoadingSpinnerBlock } from "@/components/loading-spinner";
import { MoveToCartConfirmDialog } from "@/components/move-to-cart-confirm-dialog";
import { RemoveConfirmDialog } from "@/components/remove-confirm-dialog";
import { SearchField } from "@/components/search-field";
import { useT } from "@/components/i18n-provider";
import { useAppSession } from "@/components/app-session-provider";
import {
  type ExpiryPeriod,
  DEFAULT_EXPIRY_PERIOD,
  expiryPeriodToApiParam,
  getStoredExpiryPeriod,
  setStoredExpiryPeriod,
} from "@/lib/expiry-period";
import { useBrowserBackStack } from "@/lib/browser-back";
import { useViewportInsets } from "@/hooks/use-viewport-insets";
import { CancelButton } from "@/components/cancel-button";
import { ConfirmButton } from "@/components/confirm-button";
import { DangerRemoveButton } from "@/components/danger-remove-button";
import {
  appButtonDangerFull,
  appButtonNeutral,
  appFooterButtonGrid,
} from "@/lib/app-ui";
import { resolveEntryImagePath } from "@/lib/inventory-entry-display";

const PAGE_SIZE = 40;

type Entry = {
  id: string;
  barcode: string;
  articul: string | null;
  imagePath: string | null;
  quantity: number;
  enteredAt: string;
  expiryDate: string;
  priceReducedAt: string | null;
  priceDiscountPercent: number | null;
  priceReducedByUser?: { id: string; username: string } | null;
  addedByUser?: { id: string; username: string } | null;
  product: { id: string; name: string; imagePath: string | null };
};

type Pagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

function ExpiryList() {
  const { t } = useT();
  const { homeUser } = useAppSession();
  const { offsetTop, keyboardInset } = useViewportInsets();
  const searchParams = useSearchParams();
  const storeId = searchParams.get("storeId") ?? "";
  const [entries, setEntries] = useState<Entry[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: PAGE_SIZE,
    total: 0,
    totalPages: 1,
  });
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [showScanner, setShowScanner] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [priceReduceConfirmId, setPriceReduceConfirmId] = useState<string | null>(null);
  const [discountPercent, setDiscountPercent] = useState(DEFAULT_DISCOUNT_PERCENT);
  const [moveToOrdersEntry, setMoveToOrdersEntry] = useState<Entry | null>(null);
  const [moveOrdersQty, setMoveOrdersQty] = useState("1");
  const [moveOrdersSaving, setMoveOrdersSaving] = useState(false);
  const [detailEntry, setDetailEntry] = useState<ExpiryDetailEntry | null>(null);
  const [favouriteProductIds, setFavouriteProductIds] = useState<
    Record<string, true>
  >({});
  const [flashMessage, setFlashMessage] = useState<string | null>(null);
  const [flashTone, setFlashTone] = useState<"success" | "error">("success");
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Record<string, true>>({});
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);
  const [bulkRemoving, setBulkRemoving] = useState(false);
  const [loading, setLoading] = useState(() => Boolean(storeId));
  const [period, setPeriod] = useState<ExpiryPeriod>(DEFAULT_EXPIRY_PERIOD);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const entriesCountRef = useRef(0);
  const clearFlash = useCallback(() => setFlashMessage(null), []);
  const loadingMoreRef = useRef(false);
  const fetchGenerationRef = useRef(0);

  useBrowserBackStack([
    {
      id: "scanner",
      open: showScanner,
      close: () => {
        setShowScanner(false);
        setSearch("");
      },
    },
    {
      id: "detail",
      open: detailEntry !== null,
      close: () => setDetailEntry(null),
    },
    {
      id: "confirm",
      open: confirmId !== null,
      close: () => setConfirmId(null),
    },
    {
      id: "price-reduce",
      open: priceReduceConfirmId !== null,
      close: () => {
        setPriceReduceConfirmId(null);
        setDiscountPercent(DEFAULT_DISCOUNT_PERCENT);
      },
    },
    {
      id: "move-to-orders",
      open: moveToOrdersEntry !== null,
      close: () => {
        setMoveToOrdersEntry(null);
        setMoveOrdersQty("1");
      },
    },
    {
      id: "bulk-confirm",
      open: bulkConfirmOpen,
      close: () => setBulkConfirmOpen(false),
    },
    {
      id: "selection",
      open: selectionMode,
      close: () => {
        setSelectionMode(false);
        setSelectedIds({});
        setBulkConfirmOpen(false);
      },
    },
  ]);

  useEffect(() => {
    entriesCountRef.current = entries.length;
  }, [entries.length]);

  useEffect(() => {
    setPeriod(getStoredExpiryPeriod());
  }, []);

  const loadFavourites = useCallback(async () => {
    if (!storeId || homeUser !== true) return;

    const response = await fetch(
      `/api/favourites?storeId=${encodeURIComponent(storeId)}`,
    );
    const data = (await response.json()) as { productIds?: string[] };
    if (!response.ok) return;

    const nextIds: Record<string, true> = {};
    for (const id of data.productIds ?? []) {
      nextIds[id] = true;
    }
    setFavouriteProductIds(nextIds);
  }, [storeId, homeUser]);

  useEffect(() => {
    if (storeId && homeUser === true) {
      void loadFavourites();
    }
  }, [storeId, homeUser, loadFavourites]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, 150);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, period, storeId]);

  const clearSearchIfActive = useCallback(() => {
    if (!search.trim() && !debouncedSearch) return;
    setSearch("");
    setDebouncedSearch("");
  }, [search, debouncedSearch]);

  function onPeriodChange(next: ExpiryPeriod) {
    setPeriod(next);
    setStoredExpiryPeriod(next);
    setSelectionMode(false);
    setSelectedIds({});
    setBulkConfirmOpen(false);
  }

  useEffect(() => {
    setSelectionMode(false);
    setSelectedIds({});
    setBulkConfirmOpen(false);
  }, [storeId]);

  const loadEntries = useCallback(
    async (targetPage: number, append: boolean) => {
      if (!storeId) return;

      const generation = ++fetchGenerationRef.current;
      loadingMoreRef.current = true;
      if (!append && entriesCountRef.current === 0) {
        setLoading(true);
      }
      const params = new URLSearchParams({
        storeId,
        withinDays: expiryPeriodToApiParam(period),
      });
      if (debouncedSearch) {
        params.set("q", debouncedSearch);
      } else {
        params.set("page", String(targetPage));
        params.set("limit", String(PAGE_SIZE));
      }

      try {
        const response = await fetch(`/api/inventory?${params.toString()}`);
        const data = (await response.json()) as {
          entries?: Entry[];
          pagination?: Pagination;
        };

        if (generation !== fetchGenerationRef.current) return;

        const nextEntries = (data.entries ?? []).map((entry) => ({
          ...entry,
          articul: entry.articul ?? null,
          imagePath: entry.imagePath ?? null,
        }));
        setEntries((current) => (append ? [...current, ...nextEntries] : nextEntries));
        setPagination(
          data.pagination ?? {
            page: targetPage,
            limit: PAGE_SIZE,
            total: nextEntries.length,
            totalPages: 1,
          },
        );
      } finally {
        if (generation === fetchGenerationRef.current) {
          loadingMoreRef.current = false;
          setLoading(false);
        }
      }
    },
    [storeId, debouncedSearch, period],
  );

  useEffect(() => {
    if (storeId) {
      void loadEntries(page, page > 1 && !debouncedSearch);
    }
  }, [storeId, debouncedSearch, page, period, loadEntries]);

  useEffect(() => {
    if (debouncedSearch || loading) return;

    const node = loadMoreRef.current;
    if (!node || pagination.page >= pagination.totalPages) return;

    const observer = new IntersectionObserver(
      (records) => {
        if (!records[0]?.isIntersecting || loadingMoreRef.current) return;
        setPage((current) =>
          current < pagination.totalPages ? current + 1 : current,
        );
      },
      { rootMargin: "160px" },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [debouncedSearch, loading, pagination.page, pagination.totalPages, entries.length]);

  async function removeEntry(entryId: string) {
    try {
      const response = await fetch("/api/inventory", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entryId, storeId }),
      });
      if (!response.ok) {
        setFlashTone("error");
        setFlashMessage(t("errors.networkError"));
        return;
      }
      setConfirmId(null);
      setDetailEntry((current) => (current?.id === entryId ? null : current));
      setEntries((current) => current.filter((entry) => entry.id !== entryId));
      clearSearchIfActive();
    } catch {
      setFlashTone("error");
      setFlashMessage(t("errors.networkError"));
    }
  }

  function exitSelectionMode() {
    setSelectionMode(false);
    setSelectedIds({});
    setBulkConfirmOpen(false);
  }

  function enterSelectionWith(entryId: string) {
    setDetailEntry(null);
    setConfirmId(null);
    setShowScanner(false);
    setSelectionMode(true);
    setSelectedIds({ [entryId]: true });
  }

  function toggleSelected(entryId: string) {
    setSelectedIds((current) => {
      const next = { ...current };
      if (next[entryId]) delete next[entryId];
      else next[entryId] = true;
      return next;
    });
  }

  async function bulkRemoveSelected() {
    const ids = Object.keys(selectedIds);
    if (ids.length === 0 || bulkRemoving) return;
    setBulkRemoving(true);
    try {
      const response = await fetch("/api/inventory/bulk-remove", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storeId, entryIds: ids }),
      });
      const data = (await response.json()) as {
        removed?: number;
        removedIds?: string[];
        error?: string;
      };
      if (!response.ok) {
        setFlashTone("error");
        setFlashMessage(data.error ?? t("errors.networkError"));
        return;
      }
      const removedSet = new Set(data.removedIds ?? ids);
      setEntries((current) =>
        current.filter((entry) => !removedSet.has(entry.id)),
      );
      setDetailEntry((current) =>
        current && removedSet.has(current.id) ? null : current,
      );
      exitSelectionMode();
      setFlashTone("success");
      setFlashMessage(
        t("expiry.bulkRemoved", { count: data.removed ?? removedSet.size }),
      );
      clearSearchIfActive();
    } catch {
      setFlashTone("error");
      setFlashMessage(t("errors.networkError"));
    } finally {
      setBulkRemoving(false);
    }
  }

  async function reducePriceEntry(entryId: string, percent: number) {
    try {
      const response = await fetch("/api/inventory", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entryId,
          storeId,
          priceReduced: true,
          priceDiscountPercent: percent,
        }),
      });
      const data = (await response.json()) as {
        entry?: ExpiryDetailEntry;
        error?: string;
      };
      if (!response.ok || !data.entry) {
        setFlashTone("error");
        setFlashMessage(data.error ?? t("errors.networkError"));
        return;
      }
      setPriceReduceConfirmId(null);
      setDiscountPercent(DEFAULT_DISCOUNT_PERCENT);
      handleEntryUpdated(data.entry);
    } catch {
      setFlashTone("error");
      setFlashMessage(t("errors.networkError"));
    }
  }

  async function clearDiscountEntry(entryId: string) {
    try {
      const response = await fetch("/api/inventory", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entryId,
          storeId,
          priceReduced: false,
        }),
      });
      const data = (await response.json()) as {
        entry?: ExpiryDetailEntry;
        error?: string;
      };
      if (!response.ok || !data.entry) {
        setFlashTone("error");
        setFlashMessage(data.error ?? t("errors.networkError"));
        return;
      }
      setPriceReduceConfirmId(null);
      setDiscountPercent(DEFAULT_DISCOUNT_PERCENT);
      handleEntryUpdated(data.entry);
    } catch {
      setFlashTone("error");
      setFlashMessage(t("errors.networkError"));
    }
  }

  async function confirmMoveToOrders() {
    if (!moveToOrdersEntry || moveOrdersSaving) return;

    const quantity = Number(moveOrdersQty);
    if (!Number.isInteger(quantity) || quantity < 1) return;

    setMoveOrdersSaving(true);
    try {
      const response = await fetch("/api/buy-list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeId,
          productId: moveToOrdersEntry.product.id,
          barcode: moveToOrdersEntry.barcode,
          quantity,
        }),
      });
      if (!response.ok) {
        setFlashTone("error");
        setFlashMessage(t("expiry.addToOrdersFailed"));
        return;
      }

      setMoveToOrdersEntry(null);
      setMoveOrdersQty("1");
      setFlashTone("success");
      setFlashMessage(t("expiry.addedToOrders"));
      clearSearchIfActive();
    } finally {
      setMoveOrdersSaving(false);
    }
  }

  async function toggleFavourite(productId: string) {
    const isFavourite = Boolean(favouriteProductIds[productId]);
    try {
      const response = await fetch("/api/favourites", {
        method: isFavourite ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storeId, productId }),
      });
      if (!response.ok) {
        setFlashTone("error");
        setFlashMessage(t("errors.networkError"));
        return;
      }
      await loadFavourites();
    } catch {
      setFlashTone("error");
      setFlashMessage(t("errors.networkError"));
    }
  }

  function handleEntryUpdated(
    updated: ExpiryDetailEntry,
    meta?: { merged?: boolean; removedId?: string },
  ) {
    clearSearchIfActive();
    setDetailEntry((current) => (current?.id === updated.id ? updated : current));
    setEntries((current) => {
      let next = current;

      if (meta?.removedId) {
        next = next.filter((entry) => entry.id !== meta.removedId);
      } else {
        next = next.map((entry) => {
          if (entry.id === updated.id) {
            return {
              ...entry,
              barcode: updated.barcode,
              articul: updated.articul ?? null,
              imagePath: updated.imagePath ?? null,
              quantity: updated.quantity,
              expiryDate: updated.expiryDate,
              priceReducedAt: updated.priceReducedAt,
              priceDiscountPercent: updated.priceDiscountPercent ?? null,
              priceReducedByUser: updated.priceReducedByUser ?? null,
              addedByUser: updated.addedByUser ?? entry.addedByUser ?? null,
              product: updated.product,
            };
          }
          // Other batches of the same product share the underlying product
          // record, so keep their fallback picture/name in sync too instead
          // of waiting for a refetch.
          if (entry.product.id === updated.product.id) {
            return { ...entry, product: updated.product };
          }
          return entry;
        });
      }

      const hasUpdated = next.some((entry) => entry.id === updated.id);
      if (!hasUpdated) {
        next = [
          ...next,
          {
            id: updated.id,
            barcode: updated.barcode,
            articul: updated.articul ?? null,
            imagePath: updated.imagePath ?? null,
            quantity: updated.quantity,
            enteredAt: updated.enteredAt ?? new Date().toISOString(),
            expiryDate: updated.expiryDate,
            priceReducedAt: updated.priceReducedAt,
            priceDiscountPercent: updated.priceDiscountPercent ?? null,
            priceReducedByUser: updated.priceReducedByUser ?? null,
            addedByUser: updated.addedByUser ?? null,
            product: updated.product,
          },
        ];
      }

      return [...next].sort(
        (a, b) =>
          new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime(),
      );
    });
  }

  function onBarcodeScanned(barcode: string) {
    setSearch(barcode);
  }

  function confirmBarcodeSearch(barcode: string) {
    setSearch(barcode);
    setShowScanner(false);
  }

  const isSearching = debouncedSearch.length > 0;
  const emptyMessage = isSearching ? t("expiry.noResults") : t("expiry.empty");
  const isHomeUser = homeUser === true;
  const selectedCount = Object.keys(selectedIds).length;
  const confirmEntry = confirmId
    ? (entries.find((entry) => entry.id === confirmId) ?? null)
    : null;
  const priceReduceEntry = priceReduceConfirmId
    ? (entries.find((entry) => entry.id === priceReduceConfirmId) ?? null)
    : null;
  const isEditingDiscount = Boolean(priceReduceEntry?.priceReducedAt);

  return (
    <div className="mx-auto flex h-[calc(100svh-var(--app-bottom-nav-frame)-env(safe-area-inset-bottom,0px))] min-h-0 w-full max-w-lg flex-col overflow-x-visible pt-1">
      <div className={`${listPageChromeClassName} px-4`}>
        <MobilePageHeader
          title={
            selectionMode
              ? t("expiry.selectedCount", { count: selectedCount })
              : homeUser === true
                ? t("expiry.title")
                : t("expiry.storeTitle")
          }
          className="mb-0"
          action={
            selectionMode ? (
              <button
                type="button"
                className={`${appButtonNeutral} px-2.5 py-1.5 text-xs`}
                onClick={exitSelectionMode}
              >
                {t("expiry.confirmCancel")}
              </button>
            ) : undefined
          }
        />

        <ActionFlash
          message={flashMessage}
          tone={flashTone}
          onClear={clearFlash}
        />

        <ExpiryPeriodFilter value={period} onChange={onPeriodChange} />

        <div className="flex items-center gap-1.5">
          <SearchField
            value={search}
            onChange={setSearch}
            placeholder={t("expiry.searchPlaceholder")}
            aria-label={t("expiry.searchPlaceholder")}
            inputClassName="h-9 rounded-lg border border-input-border bg-input pl-2.5 text-base text-foreground"
            onClear={() => setShowScanner(false)}
          />
          <button
            type="button"
            onClick={() => setShowScanner((open) => !open)}
            className={`flex h-9 shrink-0 items-center justify-center gap-1 rounded-lg border px-2 text-[10px] font-medium leading-none ${
              showScanner
                ? "border-primary bg-selected text-primary"
                : "border-input-border bg-transparent text-primary"
            }`}
          >
            <ScanNavIcon className="h-4 w-4 text-primary" />
            <span>{t("app.navScan")}</span>
          </button>
        </div>

        {showScanner ? (
          <div className="rounded-2xl border border-card-border p-3">
            <BarcodeScanner
              autoStart
              continuousFill
              onDetect={onBarcodeScanned}
              onScan={async (barcode) => confirmBarcodeSearch(barcode)}
              onCancel={() => {
                setShowScanner(false);
                setSearch("");
              }}
            />
          </div>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto overscroll-y-contain px-1.5 pb-3.5 pt-3 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:w-0 [&::-webkit-scrollbar]:h-0">
        {loading && page === 1 && entries.length === 0 ? (
          isSearching ? (
            <p className="rounded-xl bg-transparent p-4 text-center text-sm text-muted">
              {t("expiry.searching")}
            </p>
          ) : (
            <LoadingSpinnerBlock wrapperClassName="flex justify-center rounded-xl bg-transparent p-4" />
          )
        ) : null}

        {loading && isSearching && entries.length > 0 ? (
          <p className="py-1 text-center text-xs text-muted">{t("expiry.searching")}</p>
        ) : null}

        {!loading && entries.length === 0 ? (
          <p className="rounded-xl bg-transparent p-4 text-sm text-muted">
            {emptyMessage}
          </p>
        ) : null}

        {entries.map((entry) => (
          <ExpiryListCard
            key={entry.id}
            name={entry.product.name.trim() || t("common.noName")}
            imagePath={resolveEntryImagePath(entry.imagePath, entry.product.imagePath)}
            articul={entry.articul}
            expiryDate={entry.expiryDate}
            enteredAt={entry.enteredAt}
            quantity={entry.quantity}
            priceReduced={entry.priceReducedAt !== null}
            discountPercent={entry.priceDiscountPercent}
            homeUser={isHomeUser}
            favourite={Boolean(favouriteProductIds[entry.product.id])}
            selectionMode={selectionMode}
            selected={Boolean(selectedIds[entry.id])}
            onOpen={() => setDetailEntry(entry)}
            onRemove={() => setConfirmId(entry.id)}
            onReducePrice={() => {
              setDiscountPercent(
                entry.priceDiscountPercent ?? DEFAULT_DISCOUNT_PERCENT,
              );
              setPriceReduceConfirmId(entry.id);
            }}
            onMoveToOrders={() => {
              setMoveToOrdersEntry(entry);
              setMoveOrdersQty("1");
            }}
            onToggleFavourite={
              isHomeUser
                ? () => void toggleFavourite(entry.product.id)
                : undefined
            }
            onLongPressSelect={() => enterSelectionWith(entry.id)}
            onToggleSelected={() => toggleSelected(entry.id)}
          />
        ))}

        {!isSearching && pagination.page < pagination.totalPages ? (
          <div ref={loadMoreRef} className="h-2" aria-hidden />
        ) : null}

        {loading && page > 1 ? (
          <LoadingSpinnerBlock
            size="sm"
            wrapperClassName="flex justify-center py-2"
          />
        ) : null}

        {selectionMode ? (
          <div className="h-16 shrink-0" aria-hidden />
        ) : null}
      </div>

      {detailEntry ? (
        <ExpiryEntryDetailSheet
          entry={detailEntry}
          storeId={storeId}
          homeUser={isHomeUser}
          favourite={Boolean(favouriteProductIds[detailEntry.product.id])}
          onToggleFavourite={
            isHomeUser
              ? () => void toggleFavourite(detailEntry.product.id)
              : undefined
          }
          onClose={() => setDetailEntry(null)}
          onUpdated={handleEntryUpdated}
        />
      ) : null}

      {confirmId && confirmEntry ? (
        <RemoveConfirmDialog
          title={t("expiry.confirmTitle")}
          message={t("expiry.confirmMessage")}
          itemLabel={`${confirmEntry.product.name.trim() || t("common.noName")} (${confirmEntry.quantity} ${t("expiry.pieces")})`}
          cancelLabel={t("expiry.confirmCancel")}
          removeLabel={t("expiry.remove")}
          onCancel={() => setConfirmId(null)}
          onConfirm={() => void removeEntry(confirmId)}
        />
      ) : null}

      {bulkConfirmOpen ? (
        <RemoveConfirmDialog
          title={t("expiry.bulkConfirmTitle")}
          message={t("expiry.bulkConfirmMessage")}
          itemLabel={t("expiry.bulkConfirmItems", { count: selectedCount })}
          cancelLabel={t("expiry.confirmCancel")}
          removeLabel={t("expiry.bulkRemove", { count: selectedCount })}
          busy={bulkRemoving}
          onCancel={() => setBulkConfirmOpen(false)}
          onConfirm={() => void bulkRemoveSelected()}
        />
      ) : null}

      {selectionMode ? (
        <div
          className="fixed inset-x-0 z-50 mx-auto w-full max-w-lg border-t border-card-border bg-background/95 px-3 pb-2 pt-2 backdrop-blur-sm supports-[backdrop-filter]:bg-background/90"
          style={{
            bottom:
              "calc(var(--app-bottom-nav-height) + env(safe-area-inset-bottom, 0px))",
          }}
        >
          <div className={appFooterButtonGrid}>
            <button
              type="button"
              className={appButtonNeutral}
              onClick={exitSelectionMode}
              disabled={bulkRemoving}
            >
              {t("expiry.confirmCancel")}
            </button>
            <button
              type="button"
              className={appButtonDangerFull}
              disabled={selectedCount === 0 || bulkRemoving}
              onClick={() => setBulkConfirmOpen(true)}
            >
              {bulkRemoving
                ? t("expiry.bulkRemoving")
                : t("expiry.bulkRemove", { count: selectedCount })}
            </button>
          </div>
        </div>
      ) : null}

      {priceReduceConfirmId ? (
        <div
          className="fixed inset-x-0 z-[60] flex items-end justify-center bg-black/40"
          style={{ top: offsetTop, bottom: keyboardInset }}
        >
          <div className="w-full max-w-lg px-3 pb-[calc(var(--app-bottom-nav-height)+env(safe-area-inset-bottom,0px)+0.5rem)]">
            <div className="rounded-xl border border-card-border bg-background p-3">
              <p className="text-sm font-semibold">
                {isEditingDiscount
                  ? t("expiry.editDiscountTitle")
                  : t("expiry.reducePriceConfirmTitle")}
              </p>
              <p className="mt-1 text-xs text-muted">
                {isEditingDiscount
                  ? t("expiry.editDiscountMessage")
                  : t("expiry.reducePriceConfirmMessage")}
              </p>
              <div className="mt-3">
                <DiscountPercentPicker
                  value={discountPercent}
                  onChange={setDiscountPercent}
                />
              </div>
              {isEditingDiscount ? (
                <DangerRemoveButton
                  className="mt-3"
                  onClick={() => void clearDiscountEntry(priceReduceConfirmId)}
                >
                  {t("expiry.removeDiscount")}
                </DangerRemoveButton>
              ) : null}
              <div className={`mt-3 ${appFooterButtonGrid}`}>
                <CancelButton
                  fullWidth={false}
                  onClick={() => {
                    setPriceReduceConfirmId(null);
                    setDiscountPercent(DEFAULT_DISCOUNT_PERCENT);
                  }}
                >
                  {t("expiry.confirmCancel")}
                </CancelButton>
                <ConfirmButton
                  fullWidth={false}
                  onClick={() =>
                    void reducePriceEntry(priceReduceConfirmId, discountPercent)
                  }
                >
                  {isEditingDiscount
                    ? t("expiry.saveDiscount")
                    : t("expiry.reducePrice")}
                </ConfirmButton>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {moveToOrdersEntry ? (
        <MoveToCartConfirmDialog
          itemName={moveToOrdersEntry.product.name}
          imagePath={resolveEntryImagePath(
            moveToOrdersEntry.imagePath,
            moveToOrdersEntry.product.imagePath,
          )}
          quantity={moveOrdersQty}
          busy={moveOrdersSaving}
          onQuantityChange={setMoveOrdersQty}
          onCancel={() => {
            setMoveToOrdersEntry(null);
            setMoveOrdersQty("1");
          }}
          onConfirm={() => void confirmMoveToOrders()}
        />
      ) : null}
    </div>
  );
}

export default function ExpiryPage() {
  return (
    <Suspense>
      <ExpiryList />
    </Suspense>
  );
}

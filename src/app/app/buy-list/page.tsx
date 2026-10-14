"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActionFlash } from "@/components/action-flash";
import { CameraCapture, uploadImage } from "@/components/camera-capture";
import { BarcodeScanner } from "@/components/barcode-scanner";
import { ScanNavIcon, StarFavouriteIcon } from "@/components/app-nav-icons";
import { BuyListCard } from "@/components/buy-list-card";
import {
  BuyListEntryDetailSheet,
  type BuyListDetailEntry,
} from "@/components/buy-list-entry-detail-sheet";
import { ExpiryDatePicker } from "@/components/expiry-date-picker";
import { LoadingSpinnerBlock } from "@/components/loading-spinner";
import { ManualAddToCartDialog } from "@/components/manual-add-to-cart-dialog";
import { MobilePageHeader, listPageChromeClassName } from "@/components/mobile-page-header";
import { ProductImage } from "@/components/product-image";
import { RemoveConfirmDialog } from "@/components/remove-confirm-dialog";
import { SearchField } from "@/components/search-field";
import { useT } from "@/components/i18n-provider";
import { useAppSession } from "@/components/app-session-provider";
import { useBrowserBackStack } from "@/lib/browser-back";
import { useAppStoreId } from "@/hooks/use-app-store-id";
import { useViewportInsets } from "@/hooks/use-viewport-insets";
import { expiryYmdToIso } from "@/lib/inventory";
import { CancelButton } from "@/components/cancel-button";
import { ConfirmButton } from "@/components/confirm-button";
import {
  appFooterButtonGrid,
  appListInset,
  appSearchInput,
} from "@/lib/app-ui";

const PAGE_SIZE = 20;

type Entry = {
  id: string;
  barcode: string;
  quantity: number;
  enteredAt: string;
  checkedAt: string | null;
  product: { id: string; name: string; imagePath: string | null };
};

type FavouriteProduct = {
  id: string;
  name: string;
  barcode: string;
  imagePath: string | null;
};

type Pagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

const buyListShellClassName =
  "mx-auto flex h-[calc(100svh-var(--app-bottom-nav-frame)-env(safe-area-inset-bottom,0px))] min-h-0 w-full max-w-lg flex-col overflow-x-visible pt-1";

const buyListScrollClassName = `min-h-0 flex-1 space-y-1.5 overflow-y-auto overscroll-y-contain pb-3.5 pt-3 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:w-0 [&::-webkit-scrollbar]:h-0 ${appListInset}`;

function BuyListContent() {
  const { t } = useT();
  const { homeUser, ready: sessionReady } = useAppSession();
  const { storeId, ready: storeReady } = useAppStoreId();
  const { offsetTop, keyboardInset } = useViewportInsets();
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
  const [moveToExpiryId, setMoveToExpiryId] = useState<string | null>(null);
  const [moveExpiryYmd, setMoveExpiryYmd] = useState("");
  const [moveSaving, setMoveSaving] = useState(false);
  const [detailEntry, setDetailEntry] = useState<BuyListDetailEntry | null>(null);
  const [favouriteProductIds, setFavouriteProductIds] = useState<
    Record<string, true>
  >({});
  const [favourites, setFavourites] = useState<FavouriteProduct[]>([]);
  const [flashMessage, setFlashMessage] = useState<string | null>(null);
  const [flashTone, setFlashTone] = useState<"success" | "error">("success");
  const [addingFavouriteId, setAddingFavouriteId] = useState<string | null>(null);
  const [showManualAdd, setShowManualAdd] = useState(false);
  const [manualName, setManualName] = useState("");
  const [manualQty, setManualQty] = useState("1");
  const [manualImagePath, setManualImagePath] = useState<string | null>(null);
  const [manualImageBeforeReplace, setManualImageBeforeReplace] = useState<
    string | null | undefined
  >(undefined);
  const [manualCapturing, setManualCapturing] = useState(false);
  const [manualSaving, setManualSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const pageReady = sessionReady && storeReady;
  const loadMoreRef = useRef<HTMLDivElement>(null);
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
      id: "move-to-expiry",
      open: moveToExpiryId !== null,
      close: () => {
        setMoveToExpiryId(null);
        setMoveExpiryYmd("");
      },
    },
    {
      id: "manual-add",
      open: showManualAdd,
      close: () => {
        setShowManualAdd(false);
        setManualCapturing(false);
      },
    },
  ]);

  const loadFavourites = useCallback(async () => {
    if (!storeId || homeUser !== true) return;

    const response = await fetch(
      `/api/favourites?storeId=${encodeURIComponent(storeId)}`,
    );
    const data = (await response.json()) as {
      favourites?: Array<{ product: FavouriteProduct }>;
      productIds?: string[];
    };

    if (!response.ok) return;

    setFavourites((data.favourites ?? []).map((item) => item.product));
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

  const filteredFavourites = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    if (!q) return favourites;
    return favourites.filter((product) => {
      const name = product.name.toLowerCase();
      const barcode = product.barcode.toLowerCase();
      return name.includes(q) || barcode.includes(q);
    });
  }, [favourites, debouncedSearch]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, 150);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, storeId]);

  const clearSearchIfActive = useCallback(() => {
    if (!search.trim() && !debouncedSearch) return;
    setSearch("");
    setDebouncedSearch("");
  }, [search, debouncedSearch]);

  const loadEntries = useCallback(
    async (targetPage: number, append: boolean) => {
      if (!storeId || homeUser !== true || !pageReady) return;

      const generation = ++fetchGenerationRef.current;
      loadingMoreRef.current = true;
      setLoading(true);
      const params = new URLSearchParams({ storeId });
      if (debouncedSearch) {
        params.set("q", debouncedSearch);
      } else {
        params.set("page", String(targetPage));
        params.set("limit", String(PAGE_SIZE));
      }

      try {
        const response = await fetch(`/api/buy-list?${params.toString()}`);
        const data = (await response.json()) as {
          entries?: Entry[];
          pagination?: Pagination;
        };

        if (generation !== fetchGenerationRef.current) return;

        const nextEntries = data.entries ?? [];
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
    [storeId, debouncedSearch, homeUser, pageReady],
  );

  useEffect(() => {
    if (storeId && homeUser === true && pageReady) {
      void loadEntries(page, page > 1 && !debouncedSearch);
    }
  }, [storeId, debouncedSearch, page, homeUser, pageReady, loadEntries]);

  useEffect(() => {
    if (debouncedSearch || loading || homeUser !== true) return;

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
  }, [
    debouncedSearch,
    loading,
    homeUser,
    pagination.page,
    pagination.totalPages,
    entries.length,
  ]);

  async function reloadList() {
    setPage(1);
    setEntries([]);
    await loadEntries(1, false);
  }

  async function removeEntry(entryId: string) {
    try {
      const response = await fetch("/api/buy-list", {
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

  async function confirmMoveToExpiry() {
    if (!moveToExpiryId || !moveExpiryYmd || moveSaving) return;

    setMoveSaving(true);
    try {
      const response = await fetch("/api/buy-list/move-to-expiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeId,
          entryId: moveToExpiryId,
          expiryDate: expiryYmdToIso(moveExpiryYmd),
        }),
      });
      if (!response.ok) {
        setFlashTone("error");
        setFlashMessage(t("buyList.moveToExpiryFailed"));
        return;
      }

      setMoveToExpiryId(null);
      setMoveExpiryYmd("");
      setDetailEntry((current) =>
        current?.id === moveToExpiryId ? null : current,
      );
      await reloadList();
      setFlashTone("success");
      setFlashMessage(t("buyList.movedToExpiry"));
      clearSearchIfActive();
    } finally {
      setMoveSaving(false);
    }
  }

  async function toggleChecked(entryId: string, nextChecked: boolean) {
    setEntries((current) =>
      current.map((entry) =>
        entry.id === entryId
          ? { ...entry, checkedAt: nextChecked ? new Date().toISOString() : null }
          : entry,
      ),
    );
    try {
      const response = await fetch("/api/buy-list", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entryId, storeId, checked: nextChecked }),
      });
      if (!response.ok) {
        setEntries((current) =>
          current.map((entry) =>
            entry.id === entryId
              ? { ...entry, checkedAt: nextChecked ? null : new Date().toISOString() }
              : entry,
          ),
        );
        setFlashTone("error");
        setFlashMessage(t("errors.networkError"));
      } else {
        clearSearchIfActive();
      }
    } catch {
      setEntries((current) =>
        current.map((entry) =>
          entry.id === entryId
            ? { ...entry, checkedAt: nextChecked ? null : new Date().toISOString() }
            : entry,
        ),
      );
      setFlashTone("error");
      setFlashMessage(t("errors.networkError"));
    }
  }

  async function setFavourite(productId: string, nextFavourite: boolean) {
    const isFavourite = Boolean(favouriteProductIds[productId]);
    if (isFavourite === nextFavourite) return;
    try {
      const response = await fetch("/api/favourites", {
        method: nextFavourite ? "POST" : "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storeId, productId }),
      });
      if (!response.ok) {
        setFlashTone("error");
        setFlashMessage(t("errors.networkError"));
        return;
      }
      await loadFavourites();
      clearSearchIfActive();
    } catch {
      setFlashTone("error");
      setFlashMessage(t("errors.networkError"));
    }
  }

  async function toggleFavourite(productId: string) {
    await setFavourite(productId, !Boolean(favouriteProductIds[productId]));
  }

  async function addFavouriteToOrders(product: FavouriteProduct) {
    if (addingFavouriteId) return;
    setAddingFavouriteId(product.id);
    try {
      const response = await fetch("/api/buy-list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeId,
          productId: product.id,
          barcode: product.barcode,
          quantity: 1,
        }),
      });
      if (!response.ok) {
        setFlashTone("error");
        setFlashMessage(t("buyList.addFailed"));
        return;
      }
      await reloadList();
      setFlashTone("success");
      setFlashMessage(t("buyList.addedFromFavourite"));
      clearSearchIfActive();
    } finally {
      setAddingFavouriteId(null);
    }
  }

  function handleEntryUpdated(updated: BuyListDetailEntry) {
    clearSearchIfActive();
    setDetailEntry((current) => (current?.id === updated.id ? updated : current));
    setEntries((current) =>
      current.map((entry) =>
        entry.id === updated.id
          ? {
              ...entry,
              barcode: updated.barcode,
              quantity: updated.quantity,
              product: updated.product,
            }
          : entry,
      ),
    );
    // The product record (name/image) is shared across the cart, the
    // favourites strip, and the expiry list, so keep the already-loaded
    // favourites strip in sync too instead of waiting for a refetch.
    setFavourites((current) =>
      current.map((product) =>
        product.id === updated.product.id
          ? { ...product, name: updated.product.name, imagePath: updated.product.imagePath }
          : product,
      ),
    );
  }

  function resetManualAdd() {
    setShowManualAdd(false);
    setManualName("");
    setManualQty("1");
    setManualImagePath(null);
    setManualImageBeforeReplace(undefined);
    setManualCapturing(false);
    setManualSaving(false);
  }

  async function confirmManualAdd() {
    const quantity = Number(manualQty);
    if (!Number.isInteger(quantity) || quantity < 1) return;
    if (!manualName.trim() && !manualImagePath) {
      setFlashTone("error");
      setFlashMessage(t("errors.invalidData"));
      return;
    }
    if (manualSaving) return;

    setManualSaving(true);
    try {
      const response = await fetch("/api/buy-list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeId,
          name: manualName.trim() || undefined,
          imagePath: manualImagePath,
          quantity,
        }),
      });
      if (!response.ok) {
        setFlashTone("error");
        setFlashMessage(t("buyList.addFailed"));
        return;
      }
      resetManualAdd();
      clearSearchIfActive();
      await reloadList();
      setFlashTone("success");
      setFlashMessage(t("buyList.addedManual"));
    } finally {
      setManualSaving(false);
    }
  }

  function onBarcodeScanned(barcode: string) {
    setSearch(barcode);
  }

  function confirmBarcodeSearch(barcode: string) {
    setSearch(barcode);
    setShowScanner(false);
  }

  const isSearching = debouncedSearch.length > 0;
  const emptyMessage = isSearching ? t("buyList.noResults") : t("buyList.empty");
  const confirmEntry = confirmId
    ? (entries.find((entry) => entry.id === confirmId) ?? null)
    : null;

  if (!pageReady || homeUser === null) {
    return (
      <div className={buyListShellClassName}>
        <div className={`${listPageChromeClassName} px-4`}>
          <MobilePageHeader title={t("buyList.title")} className="mb-0" />
        </div>
        <div className={buyListScrollClassName}>
          <LoadingSpinnerBlock wrapperClassName="flex justify-center rounded-xl bg-transparent p-4" />
        </div>
      </div>
    );
  }

  if (!homeUser) {
    return (
      <div className={buyListShellClassName}>
        <div className={`${listPageChromeClassName} px-4`}>
          <MobilePageHeader title={t("buyList.title")} className="mb-0" />
        </div>
        <div className={buyListScrollClassName}>
          <p className="rounded-xl bg-transparent p-4 text-sm text-muted">
            {t("buyList.unavailable")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={buyListShellClassName}>
      <div className={`${listPageChromeClassName} px-4`}>
        <MobilePageHeader title={t("buyList.title")} className="mb-0" />

        <ActionFlash
          message={flashMessage}
          tone={flashTone}
          onClear={clearFlash}
        />

        <div className="flex items-center gap-1.5">
          <SearchField
            value={search}
            onChange={setSearch}
            placeholder={t("buyList.searchPlaceholder")}
            aria-label={t("buyList.searchPlaceholder")}
            inputClassName={appSearchInput}
            onClear={() => setShowScanner(false)}
            trailingAction={
              <button
                type="button"
                aria-label={t("buyList.addManual")}
                title={t("buyList.addManual")}
                className="px-1.5 text-xs font-semibold text-primary"
                onClick={() => {
                  setShowScanner(false);
                  (document.activeElement as HTMLElement | null)?.blur?.();
                  setManualName(search);
                  setManualQty("1");
                  setManualImagePath(null);
                  setShowManualAdd(true);
                }}
              >
                {t("buyList.addManual")}
              </button>
            }
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

        {filteredFavourites.length > 0 ? (
          <section aria-label={t("buyList.favouritesTitle")}>
            <div className="mb-1.5 flex items-center gap-2">
              <h2 className="text-[11px] font-semibold uppercase tracking-wide text-foreground">
                {t("buyList.favouritesTitle")}
              </h2>
              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-semibold tabular-nums text-primary-fg">
                {filteredFavourites.length}
                {debouncedSearch && filteredFavourites.length !== favourites.length
                  ? `/${favourites.length}`
                  : ""}
              </span>
            </div>
            <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {filteredFavourites.map((product) => (
                <div
                  key={product.id}
                  className="flex w-[4.5rem] shrink-0 flex-col items-center gap-1 rounded-lg border border-card-border bg-transparent p-1.5"
                >
                  <div className="relative size-11 shrink-0">
                    <button
                      type="button"
                      disabled={addingFavouriteId === product.id}
                      onClick={() => void addFavouriteToOrders(product)}
                      title={t("buyList.addFavouriteToOrders")}
                      aria-label={`${t("buyList.addFavouriteToOrders")}: ${product.name}`}
                      className="block size-11 overflow-hidden rounded-md disabled:opacity-60"
                    >
                      <ProductImage
                        src={product.imagePath}
                        alt=""
                        className="size-11 rounded-md object-cover"
                        placeholderClassName="size-11 rounded-md text-[8px]"
                      />
                    </button>
                    <button
                      type="button"
                      aria-label={t("favourites.remove")}
                      title={t("favourites.remove")}
                      className="absolute -right-0.5 -top-0.5 z-10 flex size-5 items-center justify-center rounded-md border border-card-border bg-background/95 text-amber-400"
                      onClick={() => void toggleFavourite(product.id)}
                    >
                      <StarFavouriteIcon className="size-3" filled />
                    </button>
                  </div>
                  <button
                    type="button"
                    disabled={addingFavouriteId === product.id}
                    onClick={() => void addFavouriteToOrders(product)}
                    className="line-clamp-2 w-full text-center text-[10px] font-medium leading-tight text-foreground disabled:opacity-60"
                  >
                    {addingFavouriteId === product.id
                      ? t("buyList.adding")
                      : product.name}
                  </button>
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </div>

      <div className={buyListScrollClassName}>
        {loading && page === 1 && entries.length === 0 ? (
          isSearching ? (
            <p className="rounded-xl bg-transparent p-4 text-center text-sm text-muted">
              {t("buyList.searching")}
            </p>
          ) : (
            <LoadingSpinnerBlock wrapperClassName="flex justify-center rounded-xl bg-transparent p-4" />
          )
        ) : null}

        {loading && isSearching && entries.length > 0 ? (
          <p className="py-1 text-center text-xs text-muted">{t("buyList.searching")}</p>
        ) : null}

        {!loading && entries.length === 0 ? (
          <p className="rounded-xl bg-transparent p-4 text-sm text-muted">
            {emptyMessage}
          </p>
        ) : null}

        {entries.map((entry) => (
          <BuyListCard
            key={entry.id}
            name={entry.product.name.trim() || t("common.noName")}
            imagePath={entry.product.imagePath}
            enteredAt={entry.enteredAt}
            quantity={entry.quantity}
            checked={entry.checkedAt !== null}
            favourite={Boolean(favouriteProductIds[entry.product.id])}
            onOpen={() => setDetailEntry(entry)}
            onRemove={() => setConfirmId(entry.id)}
            onMoveToExpiry={() => {
              setMoveToExpiryId(entry.id);
              setMoveExpiryYmd("");
            }}
            onToggleFavourite={() => void toggleFavourite(entry.product.id)}
            onToggleChecked={() => void toggleChecked(entry.id, entry.checkedAt === null)}
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
      </div>

      {detailEntry ? (
        <BuyListEntryDetailSheet
          entry={detailEntry}
          storeId={storeId}
          favourite={Boolean(favouriteProductIds[detailEntry.product.id])}
          onCommitFavourite={(nextFavourite) =>
            setFavourite(detailEntry.product.id, nextFavourite)
          }
          onClose={() => setDetailEntry(null)}
          onUpdated={handleEntryUpdated}
        />
      ) : null}

      {confirmId && confirmEntry ? (
        <RemoveConfirmDialog
          title={t("buyList.confirmTitle")}
          message={t("buyList.confirmMessage")}
          itemLabel={`${confirmEntry.product.name.trim() || t("common.noName")} (${confirmEntry.quantity} ${t("buyList.pieces")})`}
          cancelLabel={t("buyList.confirmCancel")}
          removeLabel={t("buyList.remove")}
          onCancel={() => setConfirmId(null)}
          onConfirm={() => void removeEntry(confirmId)}
        />
      ) : null}

      {moveToExpiryId ? (
        <div
          className="fixed inset-x-0 z-[60] flex items-end justify-center bg-black/40"
          style={{ top: offsetTop, bottom: keyboardInset }}
        >
          <div className="max-h-full w-full max-w-lg overflow-y-auto px-3 pb-[calc(var(--app-bottom-nav-height)+env(safe-area-inset-bottom,0px)+0.5rem)]">
            <div className="rounded-xl border border-card-border bg-background p-3">
              <p className="text-sm font-semibold">
                {t("buyList.moveToExpiryTitle")}
              </p>
              <p className="mt-1 text-xs text-muted">
                {t("buyList.moveToExpiryMessage")}
              </p>
              <div className="mt-3">
                <ExpiryDatePicker
                  value={moveExpiryYmd}
                  onChange={setMoveExpiryYmd}
                />
              </div>
              <div className={`mt-3 ${appFooterButtonGrid}`}>
                <CancelButton
                  fullWidth={false}
                  disabled={moveSaving}
                  onClick={() => {
                    setMoveToExpiryId(null);
                    setMoveExpiryYmd("");
                  }}
                >
                  {t("buyList.confirmCancel")}
                </CancelButton>
                <ConfirmButton
                  fullWidth={false}
                  busy={moveSaving}
                  disabled={!moveExpiryYmd}
                  onClick={() => void confirmMoveToExpiry()}
                >
                  {t("buyList.moveToExpiryConfirm")}
                </ConfirmButton>
              </div>
            </div>
          </div>
        </div>
      ) : null}
      {showManualAdd && !manualCapturing ? (
        <ManualAddToCartDialog
          name={manualName}
          imagePath={manualImagePath}
          quantity={manualQty}
          busy={manualSaving}
          canConfirm={Boolean(manualName.trim() || manualImagePath)}
          canKeepOldPicture={
            manualImageBeforeReplace !== undefined &&
            manualImagePath !== manualImageBeforeReplace
          }
          onNameChange={setManualName}
          onQuantityChange={setManualQty}
          onAddPhoto={() => {
            setManualImageBeforeReplace(manualImagePath);
            setManualCapturing(true);
          }}
          onKeepOldPicture={() => {
            setManualImagePath(manualImageBeforeReplace ?? null);
            setManualImageBeforeReplace(undefined);
          }}
          onCancel={resetManualAdd}
          onConfirm={() => void confirmManualAdd()}
        />
      ) : null}

      {showManualAdd && manualCapturing ? (
        <div className="fixed inset-0 z-[80] flex select-none flex-col overflow-y-auto bg-background px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(0.75rem,env(safe-area-inset-top))]">
          <div className="mx-auto flex w-full max-w-md flex-col gap-3">
            <p className="text-center text-sm font-medium text-foreground select-none">
              {t("buyList.addManualPhoto")}
            </p>
            <CameraCapture
              autoStart
              forceInAppCamera
              allowFileUpload
              confirmMode="instant"
              keepOldPicture={manualImageBeforeReplace !== undefined}
              onCapture={(dataUrl) => {
                void (async () => {
                  try {
                    const path = await uploadImage(dataUrl);
                    setManualImagePath(path);
                    setManualCapturing(false);
                  } catch {
                    setFlashTone("error");
                    setFlashMessage(t("errors.uploadFailed"));
                  }
                })();
              }}
              onCancel={() => {
                setManualCapturing(false);
                setManualImageBeforeReplace(undefined);
              }}
            />
          </div>
        </div>
      ) : null}

    </div>
  );
}

export default function BuyListPage() {
  return (
    <Suspense>
      <BuyListContent />
    </Suspense>
  );
}

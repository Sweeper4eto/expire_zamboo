"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { ExpiryListCard } from "@/components/expiry-list-card";
import { ExpiryPeriodFilter } from "@/components/expiry-period-filter";
import { LoadingSpinnerBlock } from "@/components/loading-spinner";
import { SearchField } from "@/components/search-field";
import { useT } from "@/components/i18n-provider";
import {
  type ExpiryPeriod,
  DEFAULT_EXPIRY_PERIOD,
  expiryPeriodToApiParam,
} from "@/lib/expiry-period";
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
  product: { id: string; name: string; imagePath: string | null };
};

type StoreInfo = {
  id: string;
  name: string;
  active: boolean;
  client: { id: string; name: string } | null;
};

type Pagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

function AdminExpiryContent() {
  const { t } = useT();
  const searchParams = useSearchParams();
  const storeId = searchParams.get("storeId") ?? "";
  const [store, setStore] = useState<StoreInfo | null>(null);
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
  const [period, setPeriod] = useState<ExpiryPeriod>(DEFAULT_EXPIRY_PERIOD);
  const [loading, setLoading] = useState(() => Boolean(storeId));
  const [error, setError] = useState("");
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const loadingMoreRef = useRef(false);
  const fetchGenerationRef = useRef(0);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 180);
    return () => window.clearTimeout(timer);
  }, [search]);

  const loadEntries = useCallback(
    async (nextPage: number, replace: boolean) => {
      if (!storeId) return;
      const generation = ++fetchGenerationRef.current;
      if (replace) setLoading(true);
      else loadingMoreRef.current = true;
      setError("");

      try {
        const params = new URLSearchParams({
          storeId,
          page: String(nextPage),
          limit: String(PAGE_SIZE),
          withinDays: expiryPeriodToApiParam(period),
        });
        if (debouncedSearch) params.set("q", debouncedSearch);

        const response = await fetch(`/api/admin/inventory?${params}`);
        const data = await response.json().catch(() => null);
        if (generation !== fetchGenerationRef.current) return;

        if (!response.ok) {
          setError(data?.error ?? t("errors.pageLoadFailed"));
          if (replace) {
            setEntries([]);
            setStore(null);
          }
          return;
        }

        const nextEntries = (data.entries ?? []) as Entry[];
        setStore((data.store as StoreInfo | undefined) ?? null);
        setPagination(
          data.pagination ?? {
            page: nextPage,
            limit: PAGE_SIZE,
            total: nextEntries.length,
            totalPages: 1,
          },
        );
        setEntries((current) =>
          replace ? nextEntries : [...current, ...nextEntries],
        );
        setPage(nextPage);
      } finally {
        if (generation === fetchGenerationRef.current) {
          setLoading(false);
          loadingMoreRef.current = false;
        }
      }
    },
    [storeId, period, debouncedSearch, t],
  );

  useEffect(() => {
    void loadEntries(1, true);
  }, [loadEntries]);

  useEffect(() => {
    const node = loadMoreRef.current;
    if (!node) return;
    const observer = new IntersectionObserver((observed) => {
      if (!observed[0]?.isIntersecting) return;
      if (loading || loadingMoreRef.current) return;
      if (page >= pagination.totalPages) return;
      void loadEntries(page + 1, false);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [loadEntries, loading, page, pagination.totalPages]);

  const isSearching = debouncedSearch.length > 0;
  const title = store
    ? t("admin.storeExpiryTitle", { name: store.name })
    : t("admin.storeExpiry");

  return (
    <div className="mx-auto min-h-full w-full max-w-3xl px-4 py-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <Link
            href="/admin"
            className="text-sm font-medium text-accent hover:underline"
          >
            {t("admin.backToPanel")}
          </Link>
          <h1 className="mt-2 text-2xl font-semibold text-foreground">{title}</h1>
          {store?.client ? (
            <p className="mt-1 text-sm text-muted">
              {t("admin.clientRow", { name: store.client.name })}
            </p>
          ) : null}
        </div>
      </div>

      {!storeId ? (
        <p className="rounded-xl bg-transparent p-4 text-sm text-muted">
          {t("admin.selectStoreForExpiry")}
        </p>
      ) : (
        <div className="space-y-3">
          <ExpiryPeriodFilter
            value={period}
            onChange={(next) => {
              setPeriod(next);
              setPage(1);
            }}
          />
          <SearchField
            value={search}
            onChange={setSearch}
            placeholder={t("expiry.searchPlaceholder")}
            aria-label={t("expiry.searchPlaceholder")}
            inputClassName="h-10 rounded-xl border border-input-border bg-input px-3 text-base text-foreground"
          />
          {error ? <p className="text-sm text-error">{error}</p> : null}
          <p className="text-xs text-muted">
            {pagination.total} {t("admin.storeExpiryCountUnit")}
          </p>

          <div className="space-y-1">
            {loading && page === 1 && entries.length === 0 ? (
              isSearching ? (
                <p className="rounded-xl bg-transparent p-4 text-center text-sm text-muted">
                  {t("expiry.searching")}
                </p>
              ) : (
                <LoadingSpinnerBlock wrapperClassName="flex justify-center rounded-xl bg-transparent p-4" />
              )
            ) : null}
            {!loading && entries.length === 0 ? (
              <p className="rounded-xl bg-transparent p-4 text-sm text-muted">
                {isSearching ? t("expiry.noResults") : t("expiry.empty")}
              </p>
            ) : null}
            {entries.map((entry) => (
              <ExpiryListCard
                key={entry.id}
                mode="view"
                name={entry.product.name.trim() || t("common.noName")}
                imagePath={resolveEntryImagePath(
                  entry.imagePath,
                  entry.product.imagePath,
                )}
                articul={entry.articul}
                expiryDate={entry.expiryDate}
                enteredAt={entry.enteredAt}
                quantity={entry.quantity}
                priceReduced={entry.priceReducedAt !== null}
                discountPercent={entry.priceDiscountPercent}
                onOpen={() => undefined}
                onRemove={() => undefined}
                onReducePrice={() => undefined}
              />
            ))}
            <div ref={loadMoreRef} className="h-4" aria-hidden />
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminExpiryPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-3xl px-4 py-6 text-sm text-muted">…</div>
      }
    >
      <AdminExpiryContent />
    </Suspense>
  );
}

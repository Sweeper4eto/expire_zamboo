"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import {
  AdminEmptyState,
  AdminField,
  AdminSection,
  adminButtonRowClass,
  adminDangerButtonClass,
  adminInputClass,
  adminPaginationClass,
  adminSearchInputClass,
} from "@/components/admin/admin-ui";
import { PrimaryButton, SecondaryButton } from "@/components/auth-forms";
import { CameraCapture } from "@/components/camera-capture";
import { LoadingSpinner, LoadingSpinnerBlock } from "@/components/loading-spinner";
import { SearchField } from "@/components/search-field";
import { useT } from "@/components/i18n-provider";

type Product = {
  id: string;
  name: string;
  barcode: string;
  imagePath: string | null;
};

type Props = {
  onRefresh?: () => void;
};

export function ItemsPanel({ onRefresh }: Props) {
  const { t } = useT();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [inventoryCount, setInventoryCount] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [edit, setEdit] = useState({ name: "", barcode: "", imagePath: "" });
  const [savedEdit, setSavedEdit] = useState<typeof edit | null>(null);
  const [saveMessage, setSaveMessage] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showCamera, setShowCamera] = useState(false);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: "20",
      });
      if (query) params.set("q", query);
      const response = await fetch(`/api/admin/products?${params}`);
      const data = await response.json();
      setProducts(data.products ?? []);
      setHasMore(Boolean(data.hasMore));
    } finally {
      setLoading(false);
    }
  }, [page, query]);

  const itemDirty =
    selectedId !== null &&
    savedEdit !== null &&
    (edit.name !== savedEdit.name ||
      edit.barcode !== savedEdit.barcode ||
      edit.imagePath !== savedEdit.imagePath);

  useEffect(() => {
    void loadProducts();
  }, [loadProducts]);

  useEffect(() => {
    if (itemDirty && saveMessage === t("admin.saveSuccess")) {
      setSaveMessage("");
    }
  }, [itemDirty, saveMessage, t]);

  async function selectProduct(product: Product) {
    setSelectedId(product.id);
    setShowCamera(false);
    setInventoryCount(0);
    const snapshot = {
      name: product.name,
      barcode: product.barcode,
      imagePath: product.imagePath ?? "",
    };
    setEdit(snapshot);
    setSavedEdit(snapshot);
    setSaveMessage("");

    try {
      const response = await fetch(
        `/api/admin/products?id=${encodeURIComponent(product.id)}`,
      );
      const data = await response.json();
      if (response.ok && data.product?._count?.inventory != null) {
        setInventoryCount(data.product._count.inventory);
      }
    } catch {
      // Count is informational only.
    }
  }

  async function onSearch(event: FormEvent) {
    event.preventDefault();
    setPage(1);
    setQuery(search.trim());
  }

  async function persistImagePath(imagePath: string | null) {
    if (!selectedId) return false;
    setUploading(true);
    setSaveMessage("");
    try {
      const response = await fetch("/api/admin/products", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selectedId, imagePath }),
      });
      const data = await response.json();
      if (!response.ok) {
        setSaveMessage(data.error ?? t("errors.saveFailed"));
        return false;
      }
      const nextPath = imagePath ?? "";
      setEdit((current) => ({ ...current, imagePath: nextPath }));
      setSavedEdit((current) =>
        current ? { ...current, imagePath: nextPath } : current,
      );
      setSaveMessage(t("admin.saveSuccess"));
      await loadProducts();
      onRefresh?.();
      return true;
    } finally {
      setUploading(false);
    }
  }

  async function onImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const response = await fetch("/api/upload", { method: "POST", body: form });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? t("errors.uploadFailed"));
      await persistImagePath(data.path as string);
    } catch (error) {
      setSaveMessage(error instanceof Error ? error.message : t("errors.uploadFailed"));
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  }

  async function onCameraCapture(dataUrl: string) {
    setShowCamera(false);
    setUploading(true);
    try {
      const response = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dataUrl }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? t("errors.uploadFailed"));
      await persistImagePath(data.path as string);
    } catch (error) {
      setSaveMessage(error instanceof Error ? error.message : t("errors.uploadFailed"));
    } finally {
      setUploading(false);
    }
  }

  async function removeImage() {
    if (!edit.imagePath) return;
    if (!confirm(t("admin.confirmRemoveImage"))) return;
    await persistImagePath(null);
  }

  async function saveProduct() {
    if (!selectedId || !itemDirty) return;
    setSaving(true);
    setSaveMessage("");
    try {
      const response = await fetch("/api/admin/products", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selectedId,
          name: edit.name,
          barcode: edit.barcode,
          imagePath: edit.imagePath || null,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setSaveMessage(data.error ?? t("errors.saveFailed"));
        return;
      }
      const snapshot = { ...edit };
      setSavedEdit(snapshot);
      setSaveMessage(t("admin.saveSuccess"));
      await loadProducts();
      onRefresh?.();
    } finally {
      setSaving(false);
    }
  }

  async function deleteProduct() {
    if (!selectedId) return;
    if (!confirm(t("admin.confirmDeleteProduct"))) return;
    const response = await fetch(`/api/admin/products?id=${selectedId}`, {
      method: "DELETE",
    });
    const data = await response.json();
    if (!response.ok) {
      setSaveMessage(data.error ?? t("errors.invalidData"));
      return;
    }
    setSelectedId(null);
    setShowCamera(false);
    await loadProducts();
    onRefresh?.();
  }

  return (
    <div className="grid min-w-0 gap-6 md:grid-cols-12">
      <div className="min-w-0 md:col-span-4">
        <AdminSection title={t("admin.items")}>
          <form className="mb-4 flex min-w-0 gap-2" onSubmit={onSearch}>
            <SearchField
              value={search}
              onChange={setSearch}
              placeholder={t("admin.searchPlaceholder")}
              inputClassName={adminSearchInputClass}
            />
            <button
              type="submit"
              disabled={loading}
              className="shrink-0 rounded-xl border border-primary bg-transparent px-4 py-2 text-sm font-medium text-primary disabled:opacity-60"
            >
              {loading ? (
                <LoadingSpinner size="sm" className="mx-auto" />
              ) : (
                t("common.search")
              )}
            </button>
          </form>
          <div className="space-y-2">
            {products.length === 0 ? (
              <AdminEmptyState
                message={
                  loading ? (
                    <LoadingSpinner />
                  ) : (
                    t("admin.noItemsFound")
                  )
                }
              />
            ) : (
              products.map((product) => (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => void selectProduct(product)}
                  className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors ${
                    selectedId === product.id
                      ? "border-primary bg-primary/5"
                      : "border-card-border bg-background hover:bg-transparent"
                  }`}
                >
                  {product.imagePath ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={product.imagePath}
                      alt=""
                      className="h-12 w-12 shrink-0 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-transparent text-xs text-muted">
                      {t("admin.noImage")}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="truncate font-medium text-foreground">{product.name}</p>
                    <p className="truncate text-sm text-muted">{product.barcode}</p>
                  </div>
                </button>
              ))
            )}
          </div>
          {page > 1 || hasMore ? (
            <div className={`mt-4 ${adminPaginationClass}`}>
              <p className="text-sm text-muted">
                {t("admin.pageOf", { page, totalPages: hasMore ? page + 1 : page })}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={page <= 1 || loading}
                  onClick={() => setPage((value) => Math.max(1, value - 1))}
                  className="rounded-lg border border-input-border px-3 py-1.5 text-sm disabled:opacity-40"
                >
                  {t("admin.previous")}
                </button>
                <button
                  type="button"
                  disabled={!hasMore || loading}
                  onClick={() => setPage((value) => value + 1)}
                  className="rounded-lg border border-input-border px-3 py-1.5 text-sm disabled:opacity-40"
                >
                  {t("admin.next")}
                </button>
              </div>
            </div>
          ) : null}
        </AdminSection>
      </div>

      <div className="min-w-0 md:col-span-8">
        {!selectedId ? (
          <AdminEmptyState message={t("admin.selectItem")} />
        ) : (
          <div className="rounded-2xl border border-card-border bg-background p-5">
            <h2 className="mb-4 text-lg font-semibold text-foreground">
              {t("admin.editItem")}
            </h2>
            <div className="mx-auto max-w-md space-y-4">
              {showCamera ? (
                <CameraCapture
                  onCapture={(dataUrl) => void onCameraCapture(dataUrl)}
                  onCancel={() => setShowCamera(false)}
                />
              ) : (
                <>
                  <div className="flex justify-center">
                    {edit.imagePath ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={edit.imagePath}
                        alt=""
                        className="h-40 w-40 rounded-2xl object-cover"
                      />
                    ) : (
                      <div className="flex h-40 w-40 items-center justify-center rounded-2xl bg-transparent text-sm text-muted">
                        {t("admin.noImage")}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap justify-center gap-2 [&>button]:w-auto [&>button]:px-4">
                    <SecondaryButton
                      type="button"
                      disabled={uploading}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      {t("admin.changeImage")}
                    </SecondaryButton>
                    <SecondaryButton
                      type="button"
                      disabled={uploading}
                      onClick={() => setShowCamera(true)}
                    >
                      {t("admin.takePhoto")}
                    </SecondaryButton>
                    {edit.imagePath ? (
                      <button
                        type="button"
                        className={adminDangerButtonClass}
                        disabled={uploading}
                        onClick={() => void removeImage()}
                      >
                        {t("admin.removeImage")}
                      </button>
                    ) : null}
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="hidden"
                    disabled={uploading}
                    onChange={(event) => void onImageChange(event)}
                  />
                  {uploading ? (
                    <LoadingSpinnerBlock wrapperClassName="flex justify-center py-1" size="sm" />
                  ) : null}
                </>
              )}
              <AdminField label={t("common.name")}>
                <input
                  className={adminInputClass}
                  value={edit.name}
                  onChange={(event) => setEdit({ ...edit, name: event.target.value })}
                />
              </AdminField>
              <AdminField label={t("common.barcode")}>
                <input
                  className={adminInputClass}
                  value={edit.barcode}
                  onChange={(event) => setEdit({ ...edit, barcode: event.target.value })}
                />
              </AdminField>
              {selectedId ? (
                <p className="text-sm text-muted">
                  {t("admin.itemInventoryCount", {
                    count: inventoryCount,
                  })}
                </p>
              ) : null}
              {saveMessage ? (
                <p
                  className={`text-sm ${
                    saveMessage === t("admin.saveSuccess")
                      ? "text-emerald-700"
                      : "text-error"
                  }`}
                >
                  {saveMessage}
                </p>
              ) : null}
              <div className={adminButtonRowClass}>
                <PrimaryButton
                  disabled={!itemDirty || saving || uploading}
                  onClick={() => void saveProduct()}
                >
                  {saving ? t("admin.saving") : t("common.save")}
                </PrimaryButton>
                <button
                  type="button"
                  className={adminDangerButtonClass}
                  onClick={() => void deleteProduct()}
                >
                  {t("common.delete")}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

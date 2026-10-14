"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Map as LeafletMap, Marker as LeafletMarker } from "leaflet";
import { useT } from "@/components/i18n-provider";
import {
  AdminField,
  AdminSection,
  adminDangerButtonClass,
  adminInputClass,
} from "@/components/admin/admin-ui";
import { appButtonPrimary, appButtonNeutral } from "@/lib/app-ui";
import { MenuSelect } from "@/components/menu-select";
import {
  MINIMART_STATUSES,
  MINIMART_STATUS_COLORS,
  type MinimartVisitStatus,
} from "@/lib/minimart-locator";

const adminActionButtonClass =
  "rounded-xl border border-primary bg-transparent px-4 py-2 text-sm font-medium text-primary disabled:opacity-50";
const adminGhostButtonClass =
  "rounded-xl border border-card-border bg-transparent px-4 py-2 text-sm font-medium text-foreground disabled:opacity-50";

export type MinimartStoreRow = {
  id: string;
  externalId: string;
  title: string;
  street: string;
  city: string;
  postalCode: string | null;
  lat: number;
  lng: number;
  status: MinimartVisitStatus;
  comment: string;
  clientId: string | null;
  clientName: string | null;
  clientHomeUser: boolean | null;
  syncedAt: string;
  manual?: boolean;
};

type ClientOption = {
  id: string;
  name: string;
  homeUser: boolean;
  active: boolean;
};

type FilterMode = "all" | MinimartVisitStatus;

const NO_CLIENT = "__none__";

type Draft = {
  title: string;
  street: string;
  city: string;
  status: MinimartVisitStatus;
  comment: string;
  clientId: string | null;
  lat: number;
  lng: number;
};

function draftFromStore(store: MinimartStoreRow): Draft {
  return {
    title: store.title,
    street: store.street,
    city: store.city,
    status: store.status,
    comment: store.comment,
    clientId: store.clientId,
    lat: store.lat,
    lng: store.lng,
  };
}

function statusMarkerHtml(status: MinimartVisitStatus): string {
  const color = MINIMART_STATUS_COLORS[status];
  return `<span style="display:block;width:16px;height:16px;border-radius:9999px;background:${color};border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.45)"></span>`;
}

export function MinimartLocatorPanel() {
  const { t } = useT();
  const [stores, setStores] = useState<MinimartStoreRow[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<FilterMode>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [placeMode, setPlaceMode] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [isNewPin, setIsNewPin] = useState(false);

  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<LeafletMap | null>(null);
  const markersRef = useRef<Map<string, LeafletMarker>>(new Map());
  const leafletRef = useRef<typeof import("leaflet") | null>(null);
  const fittedRef = useRef(false);
  const placeModeRef = useRef(placeMode);

  const selected = useMemo(
    () => stores.find((s) => s.id === selectedId) ?? null,
    [stores, selectedId],
  );

  const clientOptions = useMemo(
    () => [
      { value: NO_CLIENT, label: t("admin.minimartNoClient") },
      ...clients
        .filter((client) => !client.homeUser)
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((client) => ({
          value: client.id,
          label: client.active
            ? client.name
            : `${client.name} (${t("team.inactive")})`,
        })),
    ],
    [clients, t],
  );

  const statusLabel = useCallback(
    (status: MinimartVisitStatus) => {
      switch (status) {
        case "ACCEPTED":
          return t("admin.minimartStatusAccepted");
        case "THINKING":
          return t("admin.minimartStatusThinking");
        case "REJECTED":
          return t("admin.minimartStatusRejected");
        default:
          return t("admin.minimartStatusNotVisited");
      }
    },
    [t],
  );

  useEffect(() => {
    placeModeRef.current = placeMode;
  }, [placeMode]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch("/api/admin/clients");
        const data = (await response.json()) as {
          clients?: ClientOption[];
        };
        if (!cancelled) setClients(data.clients ?? []);
      } catch {
        if (!cancelled) setClients([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      if (filter !== "all") params.set("status", filter);
      const response = await fetch(
        `/api/admin/minimart-locator?${params.toString()}`,
      );
      const data = (await response.json()) as {
        stores?: MinimartStoreRow[];
        error?: string;
      };
      if (!response.ok) {
        setError(data.error ?? t("errors.saveFailed"));
        setStores([]);
        return;
      }
      setStores(data.stores ?? []);
    } catch {
      setError(t("errors.networkError"));
    } finally {
      setLoading(false);
    }
  }, [filter, q, t]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (isNewPin) return;
    if (!selected) {
      setDraft(null);
      return;
    }
    setDraft(draftFromStore(selected));
  }, [selected, isNewPin]);

  useEffect(() => {
    let cancelled = false;

    async function ensureMap() {
      if (!mapRef.current || mapInstance.current) return;
      const L = await import("leaflet");
      await import("leaflet/dist/leaflet.css");
      if (cancelled || !mapRef.current) return;
      leafletRef.current = L;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl:
          "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl:
          "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      if (!document.getElementById("minimart-marker-css")) {
        const style = document.createElement("style");
        style.id = "minimart-marker-css";
        style.textContent =
          ".minimart-status-marker{background:transparent!important;border:none!important}";
        document.head.appendChild(style);
      }

      const map = L.map(mapRef.current, {
        center: [42.7, 25.4],
        zoom: 7,
      });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap",
        maxZoom: 19,
      }).addTo(map);

      map.on("click", (event) => {
        if (!placeModeRef.current) return;
        const { lat, lng } = event.latlng;
        setIsNewPin(true);
        setSelectedId(null);
        setDraft({
          title: "Minimart",
          street: "",
          city: "",
          status: "NOT_VISITED",
          comment: "",
          clientId: null,
          lat,
          lng,
        });
        setPlaceMode(false);
        setMessage(t("admin.minimartPinPlaced"));
      });

      mapInstance.current = map;
    }

    void ensureMap();
    return () => {
      cancelled = true;
    };
  }, [t]);

  useEffect(() => {
    const map = mapInstance.current;
    const L = leafletRef.current;
    if (!map || !L) return;

    const nextIds = new Set(stores.map((s) => s.id));
    for (const [id, marker] of markersRef.current) {
      if (!nextIds.has(id)) {
        marker.remove();
        markersRef.current.delete(id);
      }
    }

    for (const store of stores) {
      const icon =
        store.status === "NOT_VISITED"
          ? new L.Icon.Default()
          : L.divIcon({
              className: "minimart-status-marker",
              html: statusMarkerHtml(store.status),
              iconSize: [16, 16],
              iconAnchor: [8, 8],
            });

      let marker = markersRef.current.get(store.id);
      if (!marker) {
        marker = L.marker([store.lat, store.lng], {
          draggable: true,
          icon,
        });
        marker.addTo(map);
        marker.on("click", () => {
          setIsNewPin(false);
          setSelectedId(store.id);
        });
        marker.on("dragend", () => {
          const pos = marker!.getLatLng();
          setIsNewPin(false);
          setSelectedId(store.id);
          setDraft((current) => ({
            title: current?.title ?? store.title,
            street: current?.street ?? store.street,
            city: current?.city ?? store.city,
            status: current?.status ?? store.status,
            comment: current?.comment ?? store.comment,
            clientId:
              current?.clientId !== undefined
                ? current.clientId
                : store.clientId,
            lat: pos.lat,
            lng: pos.lng,
          }));
        });
        markersRef.current.set(store.id, marker);
      } else {
        marker.setLatLng([store.lat, store.lng]);
        marker.setIcon(icon);
      }
      const label = store.city || store.title;
      marker.bindTooltip(
        `${statusLabel(store.status)} · ${label} · ${store.street || "—"}`,
        { direction: "top" },
      );
    }

    if (!fittedRef.current && stores.length > 0) {
      const bounds = L.latLngBounds(
        stores.map((s) => [s.lat, s.lng] as [number, number]),
      );
      map.fitBounds(bounds.pad(0.12));
      fittedRef.current = true;
    }
    requestAnimationFrame(() => map.invalidateSize());
  }, [stores, statusLabel]);

  useEffect(() => {
    const map = mapInstance.current;
    if (!map) return;
    // Place-mode chrome must not leave Leaflet with a stale size (blank tiles).
    const id = window.requestAnimationFrame(() => {
      map.invalidateSize();
    });
    return () => window.cancelAnimationFrame(id);
  }, [placeMode]);

  useEffect(() => {
    if (!draft || !mapInstance.current) return;
    mapInstance.current.setView(
      [draft.lat, draft.lng],
      Math.max(mapInstance.current.getZoom(), 14),
      { animate: true },
    );
  }, [draft?.lat, draft?.lng]);

  async function syncFromMinimart() {
    setSyncing(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/admin/minimart-locator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sync" }),
      });
      const data = (await response.json()) as {
        upserted?: number;
        count?: number;
        error?: string;
      };
      if (!response.ok) {
        setError(data.error ?? t("admin.minimartSyncFailed"));
        return;
      }
      fittedRef.current = false;
      setMessage(
        t("admin.minimartSyncOk", {
          upserted: data.upserted ?? 0,
          count: data.count ?? 0,
        }),
      );
      await load();
    } catch {
      setError(t("errors.networkError"));
    } finally {
      setSyncing(false);
    }
  }

  async function saveDraft() {
    if (!draft) return;
    if (!draft.city.trim()) {
      setError(t("admin.minimartCityRequired"));
      return;
    }
    setSaving(true);
    setError("");
    setMessage("");
    try {
      if (isNewPin || !selectedId) {
        const response = await fetch("/api/admin/minimart-locator", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "create",
            title: draft.title.trim() || "Store",
            street: draft.street.trim(),
            city: draft.city.trim(),
            lat: draft.lat,
            lng: draft.lng,
            status: draft.status,
            comment: draft.comment,
            clientId: draft.clientId,
          }),
        });
        const data = (await response.json()) as {
          store?: MinimartStoreRow;
          error?: string;
        };
        if (!response.ok || !data.store) {
          setError(data.error ?? t("errors.saveFailed"));
          return;
        }
        setStores((current) => [...current, data.store!]);
        setSelectedId(data.store.id);
        setIsNewPin(false);
        setDraft(draftFromStore(data.store));
        setMessage(t("admin.minimartCreated"));
        return;
      }

      const response = await fetch("/api/admin/minimart-locator", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selectedId,
          title: draft.title.trim() || "Store",
          street: draft.street.trim(),
          city: draft.city.trim(),
          lat: draft.lat,
          lng: draft.lng,
          status: draft.status,
          comment: draft.comment,
          clientId: draft.clientId,
        }),
      });
      const data = (await response.json()) as {
        store?: MinimartStoreRow;
        error?: string;
      };
      if (!response.ok || !data.store) {
        setError(data.error ?? t("errors.saveFailed"));
        return;
      }
      setStores((current) =>
        current.map((row) => (row.id === data.store!.id ? data.store! : row)),
      );
      setMessage(t("admin.minimartSaved"));
    } catch {
      setError(t("errors.networkError"));
    } finally {
      setSaving(false);
    }
  }

  async function deleteSelected() {
    if (!selectedId || isNewPin) {
      setDraft(null);
      setIsNewPin(false);
      setSelectedId(null);
      return;
    }
    if (!window.confirm(t("admin.minimartConfirmDelete"))) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch(
        `/api/admin/minimart-locator?id=${encodeURIComponent(selectedId)}`,
        { method: "DELETE" },
      );
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(data?.error ?? t("errors.saveFailed"));
        return;
      }
      setStores((current) => current.filter((row) => row.id !== selectedId));
      setSelectedId(null);
      setDraft(null);
      setMessage(t("admin.minimartDeleted"));
    } catch {
      setError(t("errors.networkError"));
    } finally {
      setSaving(false);
    }
  }

  const acceptedCount = stores.filter((s) => s.status === "ACCEPTED").length;
  const filterButtons: { id: FilterMode; label: string }[] = [
    { id: "all", label: t("admin.minimartFilterAll") },
    ...MINIMART_STATUSES.map((status) => ({
      id: status as FilterMode,
      label: statusLabel(status),
    })),
  ];

  return (
    <div className="space-y-4">
      <AdminSection title={t("admin.minimartLocator")}>
        <p className="mb-3 text-sm text-muted">{t("admin.minimartLocatorHint")}</p>
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[12rem] flex-1">
            <AdminField label={t("common.search")}>
              <input
                value={q}
                onChange={(event) => setQ(event.target.value)}
                className={adminInputClass}
                placeholder={t("admin.minimartSearchPlaceholder")}
              />
            </AdminField>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {filterButtons.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                onClick={() => setFilter(id)}
                className={`${appButtonNeutral} ${
                  filter === id ? "border-primary text-primary" : ""
                }`}
              >
                {id !== "all" ? (
                  <span
                    aria-hidden
                    className="mr-1.5 inline-block size-2 rounded-full"
                    style={{
                      background: MINIMART_STATUS_COLORS[id as MinimartVisitStatus],
                    }}
                  />
                ) : null}
                {label}
              </button>
            ))}
          </div>
          <button
            type="button"
            className={`${adminGhostButtonClass} ${
              placeMode ? "border-primary text-primary" : ""
            }`}
            onClick={() => {
              setPlaceMode((value) => !value);
              setMessage(placeMode ? "" : t("admin.minimartPlaceHint"));
            }}
          >
            {placeMode ? t("admin.minimartPlaceCancel") : t("admin.minimartPlacePin")}
          </button>
          <button
            type="button"
            className={adminGhostButtonClass}
            onClick={() => void load()}
            disabled={loading}
          >
            {t("admin.refresh")}
          </button>
          <button
            type="button"
            className={adminActionButtonClass}
            onClick={() => void syncFromMinimart()}
            disabled={syncing}
          >
            {syncing ? t("admin.minimartSyncing") : t("admin.minimartSync")}
          </button>
        </div>
        <p className="mt-2 text-xs text-muted">
          {t("admin.minimartCounts", {
            total: stores.length,
            accepted: acceptedCount,
          })}
        </p>
        {message ? (
          <p className="mt-2 text-sm text-primary">{message}</p>
        ) : null}
        {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}
      </AdminSection>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div
          className={`overflow-hidden rounded-2xl border border-card-border ${
            placeMode ? "ring-2 ring-primary/40 ring-offset-2 ring-offset-background" : ""
          }`}
        >
          <div
            ref={mapRef}
            className={`h-[28rem] w-full bg-card-border/20 lg:h-[36rem] ${
              placeMode ? "cursor-crosshair" : ""
            }`}
          />
        </div>

        <div className="flex max-h-[36rem] flex-col gap-3">
          <div className="min-h-0 flex-1 space-y-1 overflow-y-auto rounded-2xl border border-card-border p-2">
            {loading ? (
              <p className="p-2 text-sm text-muted">{t("common.loading")}</p>
            ) : stores.length === 0 ? (
              <p className="p-2 text-sm text-muted">{t("admin.minimartEmpty")}</p>
            ) : (
              stores.map((store) => (
                <button
                  key={store.id}
                  type="button"
                  onClick={() => {
                    setIsNewPin(false);
                    setSelectedId(store.id);
                  }}
                  className={`flex w-full flex-col rounded-xl border px-2.5 py-2 text-left text-sm ${
                    selectedId === store.id && !isNewPin
                      ? "border-primary/50 bg-primary/10"
                      : "border-transparent hover:bg-transparent"
                  }`}
                >
                  <span className="flex items-center gap-1.5 font-medium text-foreground">
                    <span
                      aria-hidden
                      className="inline-block size-2.5 shrink-0 rounded-full"
                      style={{
                        background: MINIMART_STATUS_COLORS[store.status],
                      }}
                    />
                    {store.city || store.title}
                    {store.manual ? (
                      <span className="ml-1 text-[10px] text-muted">
                        ({t("admin.minimartManual")})
                      </span>
                    ) : null}
                  </span>
                  <span className="pl-4 text-xs text-muted">
                    {statusLabel(store.status)} · {store.street || "—"}
                    {store.clientName
                      ? ` · ${store.clientName}`
                      : ""}
                  </span>
                </button>
              ))
            )}
          </div>

          <div className="rounded-2xl border border-card-border p-3">
            {draft ? (
              <div className="space-y-3">
                <p className="text-xs text-muted">
                  {isNewPin
                    ? t("admin.minimartNewPin")
                    : t("admin.minimartEditPin")}
                  {" · "}
                  {draft.lat.toFixed(5)}, {draft.lng.toFixed(5)}
                </p>
                <AdminField label={t("common.name")}>
                  <input
                    value={draft.title}
                    onChange={(event) =>
                      setDraft({ ...draft, title: event.target.value })
                    }
                    className={adminInputClass}
                  />
                </AdminField>
                <AdminField label={t("admin.minimartCity")}>
                  <input
                    value={draft.city}
                    onChange={(event) =>
                      setDraft({ ...draft, city: event.target.value })
                    }
                    className={adminInputClass}
                  />
                </AdminField>
                <AdminField label={t("common.address")}>
                  <input
                    value={draft.street}
                    onChange={(event) =>
                      setDraft({ ...draft, street: event.target.value })
                    }
                    className={adminInputClass}
                  />
                </AdminField>
                <AdminField label={t("admin.minimartStatus")}>
                  <MenuSelect
                    label={t("admin.minimartStatus")}
                    value={draft.status}
                    options={MINIMART_STATUSES.map((status) => ({
                      value: status,
                      label: statusLabel(status),
                    }))}
                    onChange={(status) =>
                      setDraft({ ...draft, status })
                    }
                    buttonClassName={`${adminInputClass} mt-1 flex items-center justify-between gap-2 text-left`}
                  />
                </AdminField>
                <AdminField label={t("admin.minimartLinkedClient")}>
                  <MenuSelect
                    label={t("admin.minimartLinkedClient")}
                    value={draft.clientId ?? NO_CLIENT}
                    options={clientOptions}
                    onChange={(next) =>
                      setDraft({
                        ...draft,
                        clientId: next === NO_CLIENT ? null : next,
                      })
                    }
                    buttonClassName={`${adminInputClass} mt-1 flex items-center justify-between gap-2 text-left`}
                  />
                  <p className="mt-1 text-[11px] text-muted">
                    {t("admin.minimartLinkedClientHint")}
                  </p>
                </AdminField>
                <AdminField label={t("admin.minimartComment")}>
                  <textarea
                    value={draft.comment}
                    onChange={(event) =>
                      setDraft({ ...draft, comment: event.target.value })
                    }
                    rows={4}
                    className={`${adminInputClass} resize-y`}
                    placeholder={t("admin.minimartCommentPlaceholder")}
                  />
                </AdminField>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    className={`${appButtonPrimary} w-full`}
                    disabled={saving}
                    onClick={() => void saveDraft()}
                  >
                    {saving ? t("admin.saving") : t("common.save")}
                  </button>
                  <button
                    type="button"
                    className={adminDangerButtonClass}
                    disabled={saving}
                    onClick={() => void deleteSelected()}
                  >
                    {t("common.delete")}
                  </button>
                </div>
                <p className="text-[11px] text-muted">
                  {t("admin.minimartDragHint")}
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted">{t("admin.minimartPickStore")}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

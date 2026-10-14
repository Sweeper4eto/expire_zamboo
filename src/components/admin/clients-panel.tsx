"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState, type ReactNode } from "react";
import { AccountBillingSection } from "@/components/admin/account-billing-section";
import { AccountPeopleSection } from "@/components/admin/account-people-section";
import { ReferredByPicker } from "@/components/admin/referred-by-picker";
import {
  AdminEmptyState,
  AdminField,
  AdminSection,
  AdminTabBar,
  adminButtonRowClass,
  adminDangerButtonClass,
  adminInputClass,
  adminPaginationClass,
} from "@/components/admin/admin-ui";
import { PrimaryButton } from "@/components/auth-forms";
import { CancelButton } from "@/components/cancel-button";
import { SearchField } from "@/components/search-field";
import { useT } from "@/components/i18n-provider";
import {
  DEFAULT_EXTRA_LOCATION_FEE,
  DEFAULT_FIRST_LOCATION_FEE,
} from "@/lib/location-fees";
import type { PaymentStanding } from "@/lib/payment-status";

export type Client = {
  id: string;
  name: string;
  phone: string | null;
  additionalInfo: string | null;
  active: boolean;
  homeUser: boolean;
  scheduleEnabled?: boolean;
  paymentsRequired: boolean;
  monthlyFeePerStore: number;
  referredByClientId?: string | null;
  referredBy?: { id: string; name: string } | null;
  referrals?: { id: string; name: string }[];
  expiryDefaultEarlyDays: number | null;
  expiryDefaultUrgentDays: number | null;
  expiryDefaultTime1: string | null;
  _count: { stores: number; users: number; referrals?: number };
};

type Store = {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  additionalInfo: string | null;
  active: boolean;
  monthlyFee: number;
};

type ClientsSubview = "current" | "new" | "users";
type ClientDetailTab = "overview" | "locations" | "people" | "billing" | "newStore";

type StandingInfo = {
  standing: PaymentStanding;
  unpaidMonths: number;
  expectedAmount: number;
  paymentsRequired: boolean;
  homeUser: boolean;
};

const STORES_PER_PAGE = 5;

type EditState = {
  name: string;
  phone: string;
  additionalInfo: string;
  active: boolean;
  homeUser: boolean;
  scheduleEnabled: boolean;
  paymentsRequired: boolean;
  referredByClientId: string | null;
  notifyEarlyDays: string;
  notifyUrgentDays: string;
  notifyTime1: string;
};

function clientEditState(client: Client): EditState {
  return {
    name: client.name,
    phone: client.phone ?? "",
    additionalInfo: client.additionalInfo ?? "",
    active: client.active,
    homeUser: client.homeUser,
    scheduleEnabled: client.scheduleEnabled !== false,
    paymentsRequired: Boolean(client.paymentsRequired),
    referredByClientId: client.referredByClientId ?? null,
    notifyEarlyDays:
      client.expiryDefaultEarlyDays != null
        ? String(client.expiryDefaultEarlyDays)
        : "",
    notifyUrgentDays:
      client.expiryDefaultUrgentDays != null
        ? String(client.expiryDefaultUrgentDays)
        : "",
    notifyTime1: client.expiryDefaultTime1 ?? "",
  };
}

function editIsDirty(current: EditState, saved: EditState | null) {
  if (!saved) return false;
  return (
    current.name !== saved.name ||
    current.phone !== saved.phone ||
    current.additionalInfo !== saved.additionalInfo ||
    current.active !== saved.active ||
    current.homeUser !== saved.homeUser ||
    current.scheduleEnabled !== saved.scheduleEnabled ||
    current.paymentsRequired !== saved.paymentsRequired ||
    current.referredByClientId !== saved.referredByClientId ||
    current.notifyEarlyDays !== saved.notifyEarlyDays ||
    current.notifyUrgentDays !== saved.notifyUrgentDays ||
    current.notifyTime1 !== saved.notifyTime1
  );
}

type Props = {
  /** Business accounts vs household — never mixed in one list. */
  accountKind?: "business" | "household";
  supportNewCount?: number;
  onRefresh: () => void;
  /** Deep-link from Payments portfolio into an account hub section. */
  openClientId?: string | null;
  openSection?: ClientDetailTab | null;
  onOpenConsumed?: () => void;
  /** Render global Users panel under Accounts. */
  usersSlot?: ReactNode;
};

export function ClientsPanel({
  accountKind = "business",
  supportNewCount = 0,
  onRefresh,
  openClientId = null,
  openSection = null,
  onOpenConsumed,
  usersSlot,
}: Props) {
  const { t } = useT();
  const [subview, setSubview] = useState<ClientsSubview>("current");
  const [detailTab, setDetailTab] = useState<ClientDetailTab>("overview");
  const [storePage, setStorePage] = useState(1);
  const [query, setQuery] = useState("");
  const [clients, setClients] = useState<Client[]>([]);
  const [standingByClient, setStandingByClient] = useState<
    Record<string, StandingInfo>
  >({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [stores, setStores] = useState<Store[]>([]);
  const [edit, setEdit] = useState<EditState>({
    name: "",
    phone: "",
    additionalInfo: "",
    active: true,
    homeUser: false,
    scheduleEnabled: true,
    paymentsRequired: false,
    referredByClientId: null,
    notifyEarlyDays: "",
    notifyUrgentDays: "",
    notifyTime1: "",
  });
  const [savedEdit, setSavedEdit] = useState<EditState | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [newClient, setNewClient] = useState({
    name: "",
    phone: "",
    additionalInfo: "",
  });
  const [newStore, setNewStore] = useState({
    name: "",
    address: "",
    phone: "",
    additionalInfo: "",
    monthlyFee: String(DEFAULT_FIRST_LOCATION_FEE),
  });

  const loadClients = useCallback(async (search = "") => {
    const needle = search.trim();
    const response = await fetch(
      `/api/admin/clients${needle ? `?q=${encodeURIComponent(needle)}` : ""}`,
    );
    const data = await response.json();
    setClients(data.clients ?? []);
  }, []);

  const loadStanding = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/payments?status=1");
      const data = (await response.json()) as {
        rows?: {
          client: {
            id: string;
            homeUser: boolean;
            paymentsRequired: boolean;
          };
          unpaidMonths: number;
          expectedAmount: number;
          standing: PaymentStanding;
        }[];
      };
      const map: Record<string, StandingInfo> = {};
      for (const row of data.rows ?? []) {
        map[row.client.id] = {
          standing: row.standing,
          unpaidMonths: row.unpaidMonths,
          expectedAmount: row.expectedAmount,
          paymentsRequired: row.client.paymentsRequired,
          homeUser: row.client.homeUser,
        };
      }
      setStandingByClient(map);
    } catch {
      setStandingByClient({});
    }
  }, []);

  const loadStores = useCallback(async (clientId: string) => {
    const response = await fetch(`/api/admin/stores?clientId=${clientId}`);
    const data = await response.json();
    const list = (data.stores ?? []) as Store[];
    setStores(list);
    return list;
  }, []);

  useEffect(() => {
    void loadStanding();
  }, [loadStanding]);

  useEffect(() => {
    const delayMs = query.trim() ? 250 : 0;
    const timer = window.setTimeout(() => {
      void loadClients(query);
    }, delayMs);
    return () => window.clearTimeout(timer);
  }, [query, loadClients]);

  useEffect(() => {
    setSelectedId(null);
    setStores([]);
    setSubview("current");
    setDetailTab("overview");
    setSaveMessage("");
  }, [accountKind]);

  useEffect(() => {
    if (!openClientId) return;
    const client = clients.find((row) => row.id === openClientId);
    if (!client) return;
    const matchesKind = accountKind === "household" ? client.homeUser : !client.homeUser;
    if (!matchesKind) return;
    setSubview("current");
    setSelectedId(client.id);
    setDetailTab(openSection ?? "billing");
    setStorePage(1);
    const snapshot = clientEditState(client);
    setEdit(snapshot);
    setSavedEdit(snapshot);
    setSaveMessage("");
    void loadStores(client.id);
    onOpenConsumed?.();
  }, [
    openClientId,
    openSection,
    clients,
    loadStores,
    onOpenConsumed,
    accountKind,
  ]);

  function selectClient(client: Client) {
    setSelectedId(client.id);
    setDetailTab("overview");
    setStorePage(1);
    const snapshot = clientEditState(client);
    setEdit(snapshot);
    setSavedEdit(snapshot);
    setSaveMessage("");
    void loadStores(client.id);
  }

  async function createClient(event: FormEvent) {
    event.preventDefault();
    try {
      const response = await fetch("/api/admin/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newClient.name,
          phone: newClient.phone || undefined,
          additionalInfo: newClient.additionalInfo || undefined,
          homeUser: accountKind === "household",
          paymentsRequired: accountKind === "business",
        }),
      });
      if (!response.ok) {
        setSaveMessage(t("errors.saveFailed"));
        return;
      }
      setNewClient({ name: "", phone: "", additionalInfo: "" });
      await loadClients(query);
      onRefresh();
      setSubview("current");
    } catch {
      setSaveMessage(t("errors.networkError"));
    }
  }

  async function saveClient() {
    if (!selectedId || !editIsDirty(edit, savedEdit)) return;
    setSaving(true);
    setSaveMessage("");
    try {
      const response = await fetch("/api/admin/clients", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selectedId,
          name: edit.name,
          phone: edit.phone || undefined,
          additionalInfo: edit.additionalInfo || undefined,
          active: edit.active,
          homeUser: edit.homeUser,
          scheduleEnabled: edit.scheduleEnabled,
          paymentsRequired: edit.paymentsRequired,
          referredByClientId: edit.homeUser ? null : edit.referredByClientId,
          notificationDefaults: {
            earlyDays: edit.notifyEarlyDays.trim()
              ? Number(edit.notifyEarlyDays)
              : null,
            urgentDays: edit.notifyUrgentDays.trim()
              ? Number(edit.notifyUrgentDays)
              : null,
            time1: edit.notifyTime1.trim() || null,
          },
        }),
      });
      if (!response.ok) {
        setSaveMessage(t("errors.saveFailed"));
        return;
      }
      const snapshot = { ...edit };
      setSavedEdit(snapshot);
      setSaveMessage(t("admin.saveSuccess"));
      await loadClients(query);
      onRefresh();
    } finally {
      setSaving(false);
    }
  }

  async function deleteClient() {
    if (!selectedId || !confirm(t("admin.confirmDeleteClient"))) return;
    await fetch(`/api/admin/clients?id=${selectedId}`, { method: "DELETE" });
    setSelectedId(null);
    await loadClients(query);
    onRefresh();
  }

  async function createStore(event: FormEvent) {
    event.preventDefault();
    if (!selectedId) return;
    try {
      const response = await fetch("/api/admin/stores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: selectedId,
          name: newStore.name,
          address: newStore.address || undefined,
          phone: newStore.phone || undefined,
          additionalInfo: newStore.additionalInfo || undefined,
          monthlyFee: Number(newStore.monthlyFee) || DEFAULT_FIRST_LOCATION_FEE,
        }),
      });
      if (!response.ok) {
        setSaveMessage(t("errors.saveFailed"));
        return;
      }
      setNewStore({
        name: "",
        address: "",
        phone: "",
        additionalInfo: "",
        monthlyFee: String(
          stores.length === 0
            ? DEFAULT_FIRST_LOCATION_FEE
            : DEFAULT_EXTRA_LOCATION_FEE,
        ),
      });
      const list = await loadStores(selectedId);
      await loadClients(query);
      onRefresh();
      setDetailTab("locations");
      setStorePage(Math.max(1, Math.ceil(list.length / STORES_PER_PAGE)));
    } catch {
      setSaveMessage(t("errors.networkError"));
    }
  }

  async function toggleStore(store: Store) {
    try {
      const response = await fetch("/api/admin/stores", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: store.id, active: !store.active }),
      });
      if (!response.ok) {
        setSaveMessage(t("errors.saveFailed"));
        return;
      }
      if (selectedId) await loadStores(selectedId);
      await loadStanding();
      onRefresh();
    } catch {
      setSaveMessage(t("errors.networkError"));
    }
  }

  async function deleteStore(storeId: string) {
    if (!confirm(t("admin.confirmDeleteStore"))) return;
    try {
      const response = await fetch(`/api/admin/stores?id=${storeId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        setSaveMessage(t("errors.saveFailed"));
        return;
      }
      if (selectedId) await loadStores(selectedId);
      await loadClients(query);
      onRefresh();
    } catch {
      setSaveMessage(t("errors.networkError"));
    }
  }

  const selectedClient = clients.find((client) => client.id === selectedId);
  const clientDirty = editIsDirty(edit, savedEdit);
  const storeTotalPages = Math.max(1, Math.ceil(stores.length / STORES_PER_PAGE));
  const safeStorePage = Math.min(storePage, storeTotalPages);
  const pagedStores = stores.slice(
    (safeStorePage - 1) * STORES_PER_PAGE,
    safeStorePage * STORES_PER_PAGE,
  );

  useEffect(() => {
    if (storePage > storeTotalPages) {
      setStorePage(storeTotalPages);
    }
  }, [storePage, storeTotalPages]);

  useEffect(() => {
    if (clientDirty && saveMessage === t("admin.saveSuccess")) {
      setSaveMessage("");
    }
  }, [clientDirty, saveMessage, t]);

  function standingBadge(client: Client) {
    const info = standingByClient[client.id];
    if (client.homeUser || info?.homeUser) {
      return (
        <span className="rounded-full border border-card-border px-2 py-0.5 text-[10px] text-muted">
          {t("admin.paymentsHomeExempt")}
        </span>
      );
    }
    if (!client.paymentsRequired && !info?.paymentsRequired) {
      return (
        <span className="rounded-full border border-[var(--urgency-warning-border)] bg-warning-bg px-2 py-0.5 text-[10px] text-warning-fg">
          {t("admin.paymentsRequiredOff")}
        </span>
      );
    }
    const standing = info?.standing ?? "current";
    if (standing === "behind2plus") {
      return (
        <span className="rounded-full border border-danger-border bg-red-950/40 px-2 py-0.5 text-[10px] font-semibold text-error">
          {t("admin.paymentStandingBehindN", {
            count: info?.unpaidMonths ?? 2,
          })}
        </span>
      );
    }
    if (standing === "behind1") {
      return (
        <span className="rounded-full border border-card-border px-2 py-0.5 text-[10px] text-warning-fg">
          {t("admin.paymentStandingBehind1")}
        </span>
      );
    }
    if (
      standing === "exempt" ||
      (info != null && info.expectedAmount <= 0)
    ) {
      return (
        <span className="rounded-full border border-[var(--urgency-warning-border)] bg-warning-bg px-2 py-0.5 text-[10px] text-warning-fg">
          {t("admin.paymentStandingFree")}
        </span>
      );
    }
    return (
      <span className="rounded-full border border-primary/35 bg-primary/10 px-2 py-0.5 text-[10px] text-primary">
        {t("admin.paymentStandingCurrent")}
      </span>
    );
  }

  function standingDot(client: Client) {
    const info = standingByClient[client.id];
    if (client.homeUser || info?.homeUser) {
      return <span className="mt-1 size-2 shrink-0 rounded-full bg-warning-fg" title={t("admin.paymentsHomeExempt")} />;
    }
    if (!client.paymentsRequired && !info?.paymentsRequired) {
      return <span className="mt-1 size-2 shrink-0 rounded-full bg-warning-fg" title={t("admin.paymentsRequiredOff")} />;
    }
    const standing = info?.standing ?? "current";
    if (standing === "behind2plus") {
      return <span className="mt-1 size-2 shrink-0 rounded-full bg-danger" title={t("admin.paymentStandingBehindN", { count: info?.unpaidMonths ?? 2 })} />;
    }
    if (standing === "behind1") {
      return <span className="mt-1 size-2 shrink-0 rounded-full bg-warning-fg" title={t("admin.paymentStandingBehind1")} />;
    }
    if (standing === "exempt" || (info != null && info.expectedAmount <= 0)) {
      return <span className="mt-1 size-2 shrink-0 rounded-full bg-warning-fg" title={t("admin.paymentStandingFree")} />;
    }
    return <span className="mt-1 size-2 shrink-0 rounded-full bg-primary" title={t("admin.paymentStandingCurrent")} />;
  }

  const visibleClients = clients.filter((client) =>
    accountKind === "household" ? client.homeUser : !client.homeUser,
  );

  const liveLocations = visibleClients.reduce(
    (sum, client) => sum + (client.active ? client._count.stores : 0),
    0,
  );
  const overdueClients = visibleClients.filter((client) => {
    const info = standingByClient[client.id];
    if (!info || client.homeUser || !client.paymentsRequired) return false;
    return info.standing === "behind1" || info.standing === "behind2plus";
  });
  const watchClients = visibleClients.filter((client) => {
    const info = standingByClient[client.id];
    return Boolean(info && !client.homeUser && client.paymentsRequired && info.standing === "behind1");
  });

  function renderAccountCard(client: Client) {
    return (
      <button
        key={client.id}
        type="button"
        onClick={() => selectClient(client)}
        className={`w-full rounded-xl border p-3 text-left transition-colors ${
          selectedId === client.id
            ? "border-primary bg-selected"
            : "border-card-border hover:bg-transparent"
        } ${!client.active ? "opacity-60" : ""}`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium text-foreground">{client.name}</p>
            {client.phone ? (
              <p className="mt-0.5 text-xs text-muted">{client.phone}</p>
            ) : null}
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              {standingBadge(client)}
              <span className="text-xs text-muted">
                {t("admin.storesCount", {
                  stores: client._count.stores,
                  users: client._count.users,
                })}
              </span>
            </div>
          </div>
          {standingDot(client)}
        </div>
      </button>
    );
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold text-foreground">
            {accountKind === "household"
              ? t("admin.householdNav")
              : t("admin.accounts")}
          </h2>
          <p className="mt-1 text-sm text-muted">
            {accountKind === "household"
              ? t("admin.householdListHint")
              : t("admin.accountsBusinessOnlyHint")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setSubview("users")}
            className={`rounded-xl border px-3 py-2 text-sm font-semibold ${
              subview === "users"
                ? "border-primary text-primary"
                : "border-card-border text-foreground"
            }`}
          >
            {t("admin.users")}
          </button>
          <button
            type="button"
            onClick={() => setSubview("new")}
            className={`rounded-xl border px-3 py-2 text-sm font-semibold ${
              subview === "new"
                ? "border-primary text-primary"
                : "border-primary text-primary"
            }`}
          >
            {accountKind === "household"
              ? t("admin.newHousehold")
              : t("admin.newBusiness")}
          </button>
          {subview !== "current" ? (
            <button
              type="button"
              onClick={() => setSubview("current")}
              className="rounded-xl border border-card-border px-3 py-2 text-sm font-semibold text-foreground"
            >
              {t("admin.accountsList")}
            </button>
          ) : null}
        </div>
      </div>

      {subview === "users" ? usersSlot : null}

      {subview === "new" ? (
        <div className="mx-auto max-w-md">
          <AdminSection
            title={
              accountKind === "household"
                ? t("admin.newHousehold")
                : t("admin.newBusiness")
            }
          >
            <form className="space-y-4" onSubmit={createClient}>
              <AdminField label={t("common.name")}>
                <input
                  className={adminInputClass}
                  value={newClient.name}
                  onChange={(event) =>
                    setNewClient({ ...newClient, name: event.target.value })
                  }
                  required
                />
              </AdminField>
              <AdminField label={t("common.phone")}>
                <input
                  className={adminInputClass}
                  value={newClient.phone}
                  onChange={(event) =>
                    setNewClient({ ...newClient, phone: event.target.value })
                  }
                />
              </AdminField>
              <AdminField label={t("common.additionalInfo")}>
                <textarea
                  className={`${adminInputClass} min-h-24`}
                  value={newClient.additionalInfo}
                  onChange={(event) =>
                    setNewClient({ ...newClient, additionalInfo: event.target.value })
                  }
                />
              </AdminField>
              <PrimaryButton type="submit">{t("common.create")}</PrimaryButton>
            </form>
          </AdminSection>
        </div>
      ) : subview === "current" ? (
        <>
          {accountKind === "business" ? (
            <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div className="rounded-xl border border-card-border px-3 py-2.5">
                <p className="text-[11px] text-muted">{t("admin.statBusinessAccounts")}</p>
                <p className="mt-1 text-xl font-semibold text-foreground">
                  {visibleClients.length}
                </p>
              </div>
              <div className="rounded-xl border border-card-border px-3 py-2.5">
                <p className="text-[11px] text-muted">{t("admin.statLiveLocations")}</p>
                <p className="mt-1 text-xl font-semibold text-primary">{liveLocations}</p>
              </div>
              <div className="rounded-xl border border-card-border px-3 py-2.5">
                <p className="text-[11px] text-muted">{t("admin.statPaymentOverdue")}</p>
                <p className="mt-1 text-xl font-semibold text-error">
                  {overdueClients.length}
                </p>
              </div>
              <div className="rounded-xl border border-card-border px-3 py-2.5">
                <p className="text-[11px] text-muted">{t("admin.statOpenSupport")}</p>
                <p className="mt-1 text-xl font-semibold text-warning-fg">
                  {supportNewCount}
                </p>
              </div>
            </div>
          ) : (
            <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
              <div className="rounded-xl border border-card-border px-3 py-2.5">
                <p className="text-[11px] text-muted">{t("admin.statHouseholds")}</p>
                <p className="mt-1 text-xl font-semibold text-foreground">
                  {visibleClients.length}
                </p>
              </div>
              <div className="rounded-xl border border-card-border px-3 py-2.5">
                <p className="text-[11px] text-muted">{t("common.active")}</p>
                <p className="mt-1 text-xl font-semibold text-primary">
                  {visibleClients.filter((client) => client.active).length}
                </p>
              </div>
              <div className="rounded-xl border border-card-border px-3 py-2.5">
                <p className="text-[11px] text-muted">{t("admin.statInactive")}</p>
                <p className="mt-1 text-xl font-semibold text-foreground">
                  {visibleClients.filter((client) => !client.active).length}
                </p>
              </div>
            </div>
          )}

          <div className="grid min-w-0 gap-6 lg:grid-cols-12">
          <div className="min-w-0 lg:col-span-4">
            <AdminSection
              title={
                accountKind === "household"
                  ? t("admin.householdNav")
                  : t("admin.accountsList")
              }
            >
              <span
                className={`mb-3 inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                  accountKind === "household"
                    ? "border-primary/40 text-primary"
                    : "border-sky-400/40 text-sky-300"
                }`}
              >
                {accountKind === "household"
                  ? t("admin.accountTypeHousehold")
                  : t("admin.accountTypeBusiness")}
              </span>
              <div className="mb-4">
                <SearchField
                  value={query}
                  onChange={setQuery}
                  placeholder={t("admin.searchPlaceholder")}
                  inputClassName={`${adminInputClass} min-w-0 w-full`}
                />
              </div>
              <div className="max-h-[28rem] space-y-2 overflow-y-auto">
                {visibleClients.length === 0 ? (
                  <AdminEmptyState message={t("admin.noClientsFound")} />
                ) : (
                  visibleClients.map((client) => renderAccountCard(client))
                )}
              </div>
            </AdminSection>
          </div>

          <div className="min-w-0 lg:col-span-8">
            {!selectedId ? (
              <div className="rounded-2xl border border-card-border bg-background p-5">
                <h3 className="text-base font-semibold text-foreground">
                  {accountKind === "household"
                    ? t("admin.selectHousehold")
                    : t("admin.selectBusiness")}
                </h3>
                <p className="mt-1 text-sm text-muted">
                  {accountKind === "household"
                    ? t("admin.selectHouseholdHint")
                    : t("admin.selectBusinessHint")}
                </p>
                {accountKind === "business" &&
                (overdueClients.length > 0 ||
                  watchClients.length > 0 ||
                  supportNewCount > 0) ? (
                  <div className="mt-4 overflow-hidden rounded-xl border border-card-border">
                    <p className="border-b border-card-border px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted">
                      {t("admin.needsAttention")}
                    </p>
                    <ul>
                      {overdueClients.slice(0, 5).map((client) => (
                        <li key={client.id}>
                          <button
                            type="button"
                            className="flex w-full items-center justify-between gap-3 border-b border-card-border px-3 py-2.5 text-left text-sm last:border-b-0 hover:bg-selected/40"
                            onClick={() => {
                              selectClient(client);
                              setDetailTab("billing");
                            }}
                          >
                            <span className="min-w-0 truncate text-foreground">
                              {client.name}
                            </span>
                            <span className="shrink-0 text-[11px] font-semibold text-error">
                              {t("admin.hubBilling")}
                            </span>
                          </button>
                        </li>
                      ))}
                      {supportNewCount > 0 ? (
                        <li className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm text-muted">
                          <span>
                            {t("admin.attentionSupport", {
                              count: supportNewCount,
                            })}
                          </span>
                          <span className="text-[11px] font-semibold text-error">
                            {t("support.navLabel")}
                          </span>
                        </li>
                      ) : null}
                    </ul>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="rounded-2xl border border-card-border bg-background p-5">
                <p className="mb-4 text-lg font-semibold text-foreground">
                  {selectedClient?.name}
                </p>
                <AdminTabBar
                  tabs={[
                    { id: "overview" as const, label: t("admin.hubOverview") },
                    { id: "locations" as const, label: t("admin.hubLocations") },
                    { id: "people" as const, label: t("admin.hubPeople") },
                    { id: "billing" as const, label: t("admin.hubBilling") },
                    { id: "newStore" as const, label: t("admin.newStore") },
                  ]}
                  active={detailTab}
                  onChange={(id) => {
                    setDetailTab(id);
                    if (id === "newStore") {
                      setNewStore((prev) => ({
                        ...prev,
                        monthlyFee: String(
                          stores.length === 0
                            ? DEFAULT_FIRST_LOCATION_FEE
                            : DEFAULT_EXTRA_LOCATION_FEE,
                        ),
                      }));
                    }
                  }}
                />

                <div className="mt-6">
                  {detailTab === "overview" ? (
                    <div className="mx-auto max-w-md space-y-4">
                      <div>
                        <p className="mb-2 text-sm font-medium text-foreground">
                          {t("admin.accountType")}
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              setEdit({
                                ...edit,
                                homeUser: false,
                              })
                            }
                            className={`rounded-full border px-3 py-2 text-sm font-medium transition-colors ${
                              !edit.homeUser
                                ? "border-primary/45 bg-primary/10 text-primary"
                                : "border-card-border text-muted"
                            }`}
                          >
                            {t("admin.accountTypeBusiness")}
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setEdit({
                                ...edit,
                                homeUser: true,
                                paymentsRequired: false,
                              })
                            }
                            className={`rounded-full border px-3 py-2 text-sm font-medium transition-colors ${
                              edit.homeUser
                                ? "border-primary/45 bg-primary/10 text-primary"
                                : "border-card-border text-muted"
                            }`}
                          >
                            {t("admin.accountTypeHousehold")}
                          </button>
                        </div>
                        <p className="mt-1 text-xs text-muted">
                          {t("admin.homeUserHint")}
                        </p>
                      </div>

                      <AdminField label={t("common.name")}>
                        <input
                          className={adminInputClass}
                          value={edit.name}
                          onChange={(event) =>
                            setEdit({ ...edit, name: event.target.value })
                          }
                        />
                      </AdminField>
                      <AdminField label={t("common.phone")}>
                        <input
                          className={adminInputClass}
                          value={edit.phone}
                          onChange={(event) =>
                            setEdit({ ...edit, phone: event.target.value })
                          }
                        />
                      </AdminField>
                      <AdminField label={t("common.additionalInfo")}>
                        <textarea
                          className={`${adminInputClass} min-h-20`}
                          value={edit.additionalInfo}
                          onChange={(event) =>
                            setEdit({ ...edit, additionalInfo: event.target.value })
                          }
                        />
                      </AdminField>
                      <label className="flex items-center gap-2 text-sm text-foreground">
                        <input
                          type="checkbox"
                          checked={edit.active}
                          onChange={(event) =>
                            setEdit({ ...edit, active: event.target.checked })
                          }
                        />
                        {t("admin.activeClient")}
                      </label>

                      {!edit.homeUser ? (
                        <label className="flex items-center justify-between gap-3 rounded-xl border border-card-border px-3 py-2 text-sm">
                          <span>
                            <span className="block font-semibold text-foreground">
                              {t("admin.scheduleEnabled")}
                            </span>
                            <span className="mt-0.5 block text-xs text-muted">
                              {t("admin.scheduleEnabledHint")}
                            </span>
                          </span>
                          <button
                            type="button"
                            role="switch"
                            aria-checked={edit.scheduleEnabled}
                            disabled={saving}
                            onClick={() =>
                              setEdit({
                                ...edit,
                                scheduleEnabled: !edit.scheduleEnabled,
                              })
                            }
                            className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
                              edit.scheduleEnabled
                                ? "bg-primary"
                                : "border border-card-border bg-transparent"
                            }`}
                          >
                            <span
                              aria-hidden
                              className={`absolute top-0.5 size-6 rounded-full bg-white transition-transform ${
                                edit.scheduleEnabled ? "left-5" : "left-0.5"
                              }`}
                            />
                          </button>
                        </label>
                      ) : null}

                      {!edit.homeUser && selectedId ? (
                        <ReferredByPicker
                          clientId={selectedId}
                          value={edit.referredByClientId}
                          onChange={(next) =>
                            setEdit({ ...edit, referredByClientId: next })
                          }
                          disabled={saving}
                        />
                      ) : null}

                      {!edit.homeUser ? (
                        <div className="rounded-xl border border-card-border bg-selected/20 px-3 py-2">
                          <p className="text-xs font-semibold text-foreground">
                            {t("admin.referralsCount", {
                              count:
                                selectedClient?.referrals?.length ??
                                selectedClient?._count.referrals ??
                                0,
                            })}
                          </p>
                          {(selectedClient?.referrals?.length ?? 0) === 0 ? (
                            <p className="mt-1 text-xs text-muted">
                              {t("admin.referralsEmpty")}
                            </p>
                          ) : (
                            <ul className="mt-1 space-y-0.5 text-xs text-muted">
                              {selectedClient!.referrals!.map((row) => (
                                <li key={row.id}>{row.name}</li>
                              ))}
                            </ul>
                          )}
                        </div>
                      ) : null}

                      <div className="mt-4 space-y-3 rounded-xl border border-card-border p-3">
                        <div>
                          <p className="text-sm font-medium text-foreground">
                            {t("admin.notificationDefaults")}
                          </p>
                          <p className="mt-1 text-xs text-muted">
                            {t("admin.notificationDefaultsHint")}
                          </p>
                        </div>
                        <AdminField label={t("admin.notificationEarlyDays")}>
                          <input
                            type="number"
                            min={1}
                            max={90}
                            value={edit.notifyEarlyDays}
                            onChange={(event) =>
                              setEdit({ ...edit, notifyEarlyDays: event.target.value })
                            }
                            className={adminInputClass}
                            placeholder="14"
                          />
                        </AdminField>
                        <AdminField label={t("admin.notificationUrgentDays")}>
                          <input
                            type="number"
                            min={0}
                            max={90}
                            value={edit.notifyUrgentDays}
                            onChange={(event) =>
                              setEdit({ ...edit, notifyUrgentDays: event.target.value })
                            }
                            className={adminInputClass}
                            placeholder="3"
                          />
                        </AdminField>
                        <AdminField label={t("admin.notificationTime")}>
                          <input
                            type="time"
                            value={edit.notifyTime1}
                            onChange={(event) =>
                              setEdit({ ...edit, notifyTime1: event.target.value })
                            }
                            className={adminInputClass}
                          />
                        </AdminField>
                      </div>

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
                          disabled={!clientDirty || saving}
                          onClick={() => void saveClient()}
                        >
                          {saving ? t("admin.saving") : t("common.save")}
                        </PrimaryButton>
                        <button
                          type="button"
                          className={adminDangerButtonClass}
                          onClick={() => void deleteClient()}
                        >
                          {t("common.delete")}
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {detailTab === "locations" ? (
                    <div className="space-y-4">
                      {stores.length === 0 ? (
                        <AdminEmptyState message={t("admin.noStoresYet")} />
                      ) : (
                        <>
                          <div className="space-y-2">
                            {pagedStores.map((store) => (
                              <StoreCard
                                key={store.id}
                                store={store}
                                homeUser={Boolean(selectedClient?.homeUser)}
                                onToggle={() => void toggleStore(store)}
                                onDelete={() => void deleteStore(store.id)}
                                onSaved={() => selectedId && void loadStores(selectedId)}
                              />
                            ))}
                          </div>
                          {storeTotalPages > 1 ? (
                            <div className={adminPaginationClass}>
                              <p className="text-sm text-muted">
                                {t("admin.pageOf", {
                                  page: safeStorePage,
                                  totalPages: storeTotalPages,
                                })}
                              </p>
                              <div className="flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  disabled={safeStorePage <= 1}
                                  onClick={() => setStorePage((page) => Math.max(1, page - 1))}
                                  className="rounded-lg border border-input-border px-3 py-1.5 text-sm text-foreground disabled:opacity-40"
                                >
                                  {t("admin.previous")}
                                </button>
                                <button
                                  type="button"
                                  disabled={safeStorePage >= storeTotalPages}
                                  onClick={() =>
                                    setStorePage((page) =>
                                      Math.min(storeTotalPages, page + 1),
                                    )
                                  }
                                  className="rounded-lg border border-input-border px-3 py-1.5 text-sm text-foreground disabled:opacity-40"
                                >
                                  {t("admin.next")}
                                </button>
                              </div>
                            </div>
                          ) : null}
                        </>
                      )}
                    </div>
                  ) : null}

                  {detailTab === "people" && selectedId ? (
                    <AccountPeopleSection
                      clientId={selectedId}
                      stores={stores}
                      onChanged={() => {
                        void loadClients(query);
                        onRefresh();
                      }}
                    />
                  ) : null}

                  {detailTab === "billing" && selectedId ? (
                    <AccountBillingSection
                      clientId={selectedId}
                      onChanged={() => {
                        void loadClients(query);
                        void loadStanding();
                        onRefresh();
                      }}
                    />
                  ) : null}

                  {detailTab === "newStore" ? (
                    <form
                      className="mx-auto max-w-md space-y-4"
                      onSubmit={createStore}
                    >
                      <AdminField label={t("admin.storeName")}>
                        <input
                          className={adminInputClass}
                          value={newStore.name}
                          onChange={(event) =>
                            setNewStore({ ...newStore, name: event.target.value })
                          }
                          required
                        />
                      </AdminField>
                      <AdminField label={t("common.address")}>
                        <input
                          className={adminInputClass}
                          value={newStore.address}
                          onChange={(event) =>
                            setNewStore({ ...newStore, address: event.target.value })
                          }
                        />
                      </AdminField>
                      <AdminField label={t("common.phone")}>
                        <input
                          className={adminInputClass}
                          value={newStore.phone}
                          onChange={(event) =>
                            setNewStore({ ...newStore, phone: event.target.value })
                          }
                        />
                      </AdminField>
                      <AdminField label={t("common.additionalInfo")}>
                        <textarea
                          className={`${adminInputClass} min-h-16`}
                          value={newStore.additionalInfo}
                          onChange={(event) =>
                            setNewStore({ ...newStore, additionalInfo: event.target.value })
                          }
                        />
                      </AdminField>
                      <AdminField label={t("admin.locationFee")}>
                        <input
                          className={adminInputClass}
                          inputMode="decimal"
                          value={newStore.monthlyFee}
                          onChange={(event) =>
                            setNewStore({
                              ...newStore,
                              monthlyFee: event.target.value,
                            })
                          }
                        />
                        <p className="mt-1 text-xs text-muted">
                          {t("admin.locationFeeHint")}
                        </p>
                      </AdminField>
                      <PrimaryButton type="submit">{t("admin.addStore")}</PrimaryButton>
                    </form>
                  ) : null}
                </div>
              </div>
            )}
          </div>
        </div>
        </>
      ) : null}
    </div>
  );
}

function StoreCard({
  store,
  homeUser,
  onToggle,
  onDelete,
  onSaved,
}: {
  store: Store;
  homeUser: boolean;
  onToggle: () => void;
  onDelete: () => void;
  onSaved: () => void;
}) {
  const { t } = useT();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    name: store.name,
    address: store.address ?? "",
    phone: store.phone ?? "",
    additionalInfo: store.additionalInfo ?? "",
    monthlyFee: String(store.monthlyFee),
  });
  const [savedForm, setSavedForm] = useState(form);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");

  const storeDirty =
    editing &&
    (form.name !== savedForm.name ||
      form.address !== savedForm.address ||
      form.phone !== savedForm.phone ||
      form.additionalInfo !== savedForm.additionalInfo ||
      form.monthlyFee !== savedForm.monthlyFee);

  function openEdit() {
    const snapshot = {
      name: store.name,
      address: store.address ?? "",
      phone: store.phone ?? "",
      additionalInfo: store.additionalInfo ?? "",
      monthlyFee: String(store.monthlyFee),
    };
    setForm(snapshot);
    setSavedForm(snapshot);
    setSaveMessage("");
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
    setSaveMessage("");
  }

  async function save() {
    if (!storeDirty) return;
    setSaving(true);
    setSaveMessage("");
    try {
      const response = await fetch("/api/admin/stores", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: store.id,
          name: form.name,
          address: form.address || undefined,
          phone: form.phone || undefined,
          additionalInfo: form.additionalInfo || undefined,
          monthlyFee: Number(form.monthlyFee) || 0,
        }),
      });
      if (!response.ok) {
        setSaveMessage(t("errors.saveFailed"));
        return;
      }
      setSavedForm({ ...form });
      setSaveMessage(t("admin.saveSuccess"));
      setEditing(false);
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className={`rounded-xl border border-card-border bg-background p-3 ${!store.active ? "opacity-60" : ""}`}
    >
      {editing ? (
        <div className="space-y-2">
          <input
            className="w-full rounded-lg border border-input-border bg-transparent px-2 py-1 text-sm text-foreground"
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
          />
          <input
            className="w-full rounded-lg border border-input-border bg-transparent px-2 py-1 text-sm text-foreground"
            placeholder={t("common.address")}
            value={form.address}
            onChange={(event) => setForm({ ...form, address: event.target.value })}
          />
          <input
            className="w-full rounded-lg border border-input-border bg-transparent px-2 py-1 text-sm text-foreground"
            placeholder={t("common.phone")}
            value={form.phone}
            onChange={(event) => setForm({ ...form, phone: event.target.value })}
          />
          <textarea
            className="w-full rounded-lg border border-input-border bg-transparent px-2 py-1 text-sm text-foreground"
            placeholder={t("common.additionalInfo")}
            value={form.additionalInfo}
            onChange={(event) =>
              setForm({ ...form, additionalInfo: event.target.value })
            }
          />
          <input
            className="w-full rounded-lg border border-input-border bg-transparent px-2 py-1 text-sm text-foreground"
            inputMode="decimal"
            placeholder={t("admin.locationFee")}
            value={form.monthlyFee}
            onChange={(event) =>
              setForm({ ...form, monthlyFee: event.target.value })
            }
          />
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={!storeDirty || saving}
              className="w-full rounded-lg border border-primary bg-transparent px-2 py-2 text-xs text-primary disabled:opacity-50"
              onClick={() => void save()}
            >
              {saving ? t("admin.saving") : t("common.save")}
            </button>
            <CancelButton
              className="rounded-lg px-2 py-2 text-xs"
              onClick={cancelEdit}
            >
              {t("common.cancel")}
            </CancelButton>
          </div>
        </div>
      ) : (
        <>
          <Link
            href={`/admin/expiry?storeId=${encodeURIComponent(store.id)}`}
            className="block font-medium text-foreground hover:text-primary hover:underline"
          >
            {store.name}
          </Link>
          <p className="text-xs text-muted">{store.address}</p>
          <p className="text-xs text-muted">{store.phone}</p>
          <p className="text-xs text-muted">{store.additionalInfo}</p>
          <p className="text-xs tabular-nums text-muted">
            {t("admin.locationFee")}: {store.monthlyFee.toFixed(2)}{" "}
            {t("common.currency")}
          </p>
          {saveMessage ? (
            <p
              className={`mt-2 text-xs ${
                saveMessage === t("admin.saveSuccess")
                  ? "text-emerald-700"
                  : "text-error"
              }`}
            >
              {saveMessage}
            </p>
          ) : null}
          <div className="mt-2 flex flex-wrap gap-2">
            <Link
              href={`/admin/expiry?storeId=${encodeURIComponent(store.id)}`}
              className="rounded-lg border border-primary bg-selected px-2 py-1 text-xs font-medium text-primary"
            >
              {t("admin.viewExpiry")}
            </Link>
            {homeUser ? (
              <Link
                href={`/admin/buy-list?storeId=${encodeURIComponent(store.id)}`}
                className="rounded-lg border border-primary bg-selected px-2 py-1 text-xs font-medium text-primary"
              >
                {t("admin.viewCart")}
              </Link>
            ) : null}
            <button
              type="button"
              className="rounded-lg border border-input-border bg-transparent px-2 py-1 text-xs text-foreground"
              onClick={openEdit}
            >
              {t("common.edit")}
            </button>
            <button
              type="button"
              className="rounded-lg border border-input-border bg-transparent px-2 py-1 text-xs text-foreground"
              onClick={onToggle}
            >
              {store.active
                ? t("admin.disableLocation")
                : t("admin.enableLocation")}
            </button>
            <button
              type="button"
              className="rounded-lg border border-danger-border px-2 py-1 text-xs text-error"
              onClick={onDelete}
            >
              {t("common.delete")}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

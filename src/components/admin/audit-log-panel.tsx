"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  AdminField,
  AdminTabBar,
  adminInputClass,
  adminPaginationClass,
  adminSearchInputClass,
} from "@/components/admin/admin-ui";
import { LoadingSpinnerBlock } from "@/components/loading-spinner";
import { MenuSelect } from "@/components/menu-select";
import { SearchField } from "@/components/search-field";
import { useT } from "@/components/i18n-provider";
import type { MessageKey } from "@/i18n";

type AuditEntry = {
  id: string;
  userId: string;
  username: string;
  event: string;
  ipAddress: string;
  deviceInfo: string;
  details: string;
  occurredAt: string;
};

type AuditFilter = "all" | "auth" | "inventory" | "products" | "admin";
type AccountKind = "business" | "household";

type StoreOption = {
  id: string;
  name: string;
  active: boolean;
  clientName: string;
};

type ClientOption = {
  id: string;
  name: string;
  homeUser: boolean;
  active: boolean;
};

const PAGE_SIZES = [10, 20, 50] as const;
const ALL = "__all__";

function eventLabelKey(event: string): MessageKey {
  const key = `admin.auditEvents.${event}` as MessageKey;
  return key;
}

export function AuditLogPanel() {
  const { t } = useT();
  const [accountKind, setAccountKind] = useState<AccountKind>("business");
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<AuditFilter>("all");
  const [clientId, setClientId] = useState(ALL);
  const [username, setUsername] = useState(ALL);
  const [storeName, setStoreName] = useState(ALL);
  const [storeSearch, setStoreSearch] = useState("");
  const [ip, setIp] = useState("");
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [usernames, setUsernames] = useState<string[]>([]);
  const [stores, setStores] = useState<StoreOption[]>([]);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [timeFrom, setTimeFrom] = useState("");
  const [timeTo, setTimeTo] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(20);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [error, setError] = useState("");

  const clientOptions = useMemo(
    () => [
      {
        value: ALL,
        label:
          accountKind === "household"
            ? t("admin.auditAllHouseholdClients")
            : t("admin.auditAllBusinessClients"),
      },
      ...clients.map((client) => ({
        value: client.id,
        label: client.active
          ? client.name
          : `${client.name} (${t("team.inactive")})`,
      })),
    ],
    [clients, accountKind, t],
  );

  const storeOptions = useMemo(() => {
    const needle = storeSearch.trim().toLowerCase();
    const filtered = needle
      ? stores.filter(
          (store) =>
            store.name.toLowerCase().includes(needle) ||
            store.clientName.toLowerCase().includes(needle) ||
            store.name === storeName,
        )
      : stores;
    return [
      { value: ALL, label: t("admin.auditAllStores") },
      ...filtered.map((store) => ({
        value: store.name,
        label: store.active
          ? `${store.name} · ${store.clientName}`
          : `${store.name} · ${store.clientName} (${t("team.inactive")})`,
      })),
    ];
  }, [stores, storeSearch, storeName, t]);

  const usernameOptions = useMemo(
    () => [
      {
        value: ALL,
        label:
          clientId === ALL
            ? t("admin.auditAllUsers")
            : t("admin.auditAllClientUsers"),
      },
      ...usernames.map((name) => ({ value: name, label: name })),
    ],
    [usernames, clientId, t],
  );

  const loadAuditLog = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        filter,
        accountKind,
        page: String(page),
        pageSize: String(pageSize),
        options: "1",
      });
      if (query) params.set("q", query);
      if (clientId !== ALL) params.set("clientId", clientId);
      if (username !== ALL) params.set("username", username);
      if (storeName !== ALL) params.set("store", storeName);
      if (ip.trim()) params.set("ip", ip.trim());
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
      if (timeFrom) params.set("timeFrom", timeFrom);
      if (timeTo) params.set("timeTo", timeTo);

      const response = await fetch(`/api/admin/audit-log?${params}`, { signal });
      const text = await response.text();
      if (!text) {
        throw new Error(t("admin.failedLoadAuditLog"));
      }
      const data = JSON.parse(text) as {
        entries?: AuditEntry[];
        total?: number;
        totalPages?: number;
        page?: number;
        pageSize?: number;
        error?: string;
        options?: {
          clients?: ClientOption[];
          usernames?: string[];
          stores?: StoreOption[];
        };
      };
      if (!response.ok) {
        throw new Error(data.error ?? t("admin.failedLoadAuditLog"));
      }
      setEntries(data.entries ?? []);
      setTotal(data.total ?? 0);
      setTotalPages(data.totalPages ?? 1);
      setPage(data.page ?? 1);
      if (data.pageSize && PAGE_SIZES.includes(data.pageSize as (typeof PAGE_SIZES)[number])) {
        setPageSize(data.pageSize);
      }
      if (data.options) {
        setClients(data.options.clients ?? []);
        setUsernames(data.options.usernames ?? []);
        setStores(data.options.stores ?? []);
      }
    } catch (loadError) {
      if (loadError instanceof DOMException && loadError.name === "AbortError") {
        return;
      }
      setEntries([]);
      setTotal(0);
      setError(
        loadError instanceof Error ? loadError.message : t("admin.failedLoadAuditLog"),
      );
    } finally {
      setLoading(false);
    }
  }, [
    accountKind,
    filter,
    page,
    pageSize,
    query,
    clientId,
    username,
    storeName,
    ip,
    dateFrom,
    dateTo,
    timeFrom,
    timeTo,
    t,
  ]);

  useEffect(() => {
    const controller = new AbortController();
    void loadAuditLog(controller.signal);
    return () => controller.abort();
  }, [loadAuditLog]);

  useEffect(() => {
    if (username !== ALL && usernames.length > 0 && !usernames.includes(username)) {
      setUsername(ALL);
      setPage(1);
    }
  }, [usernames, username]);

  useEffect(() => {
    if (
      storeName !== ALL &&
      stores.length > 0 &&
      !stores.some((store) => store.name === storeName)
    ) {
      setStoreName(ALL);
      setPage(1);
    }
  }, [stores, storeName]);

  useEffect(() => {
    if (clientId !== ALL && clients.length > 0 && !clients.some((c) => c.id === clientId)) {
      setClientId(ALL);
      setPage(1);
    }
  }, [clients, clientId]);

  function onSearch(event: FormEvent) {
    event.preventDefault();
    setPage(1);
    setQuery(search.trim());
  }

  function clearFilters() {
    setFilter("all");
    setClientId(ALL);
    setUsername(ALL);
    setStoreName(ALL);
    setStoreSearch("");
    setIp("");
    setSearch("");
    setQuery("");
    setDateFrom("");
    setDateTo("");
    setTimeFrom("");
    setTimeTo("");
    setPage(1);
  }

  function switchAccountKind(next: AccountKind) {
    if (next === accountKind) return;
    setAccountKind(next);
    setClientId(ALL);
    setUsername(ALL);
    setStoreName(ALL);
    setStoreSearch("");
    setPage(1);
  }

  function formatDate(iso: string) {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return iso;
    return date.toLocaleString();
  }

  function formatEvent(event: string) {
    const key = eventLabelKey(event);
    const translated = t(key);
    return translated === key ? event : translated;
  }

  function eventClass(event: string) {
    if (event === "login") return "bg-emerald-100 text-emerald-800";
    if (event === "logout") return "border border-card-border bg-transparent text-muted";
    if (event.startsWith("client_") || event.startsWith("store_") || event === "user_updated" || event === "payment_recorded") {
      return "bg-violet-100 text-violet-800";
    }
    if (event.startsWith("product_")) return "bg-sky-100 text-sky-800";
    if (event.startsWith("inventory_")) return "bg-amber-100 text-amber-900";
    return "bg-blue-100 text-blue-800";
  }

  const safePage = Math.min(page, totalPages);
  const start = total === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const end = Math.min(safePage * pageSize, total);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-foreground">{t("admin.auditLog")}</h2>
        <p className="mt-1 text-sm text-muted">{t("admin.auditDescription")}</p>
      </div>

      <AdminTabBar
        tabs={[
          { id: "business" as const, label: t("admin.accountTypeBusiness") },
          { id: "household" as const, label: t("admin.accountTypeHousehold") },
        ]}
        active={accountKind}
        onChange={switchAccountKind}
      />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <AdminField label={t("admin.eventType")}>
          <MenuSelect
            label={t("admin.eventType")}
            value={filter}
            options={[
              { value: "all", label: t("admin.auditFilters.all") },
              { value: "auth", label: t("admin.auditFilters.auth") },
              { value: "inventory", label: t("admin.auditFilters.inventory") },
              { value: "products", label: t("admin.auditFilters.products") },
              { value: "admin", label: t("admin.auditFilters.admin") },
            ]}
            onChange={(next) => {
              setFilter(next);
              setPage(1);
            }}
          />
        </AdminField>
        <AdminField label={t("admin.auditClientFilter")}>
          <MenuSelect
            label={t("admin.auditClientFilter")}
            value={clientId}
            options={clientOptions}
            onChange={(next) => {
              setClientId(next);
              setUsername(ALL);
              setStoreName(ALL);
              setStoreSearch("");
              setPage(1);
            }}
          />
        </AdminField>
        <AdminField label={t("admin.userLabel")}>
          <MenuSelect
            label={t("admin.userLabel")}
            value={username}
            options={usernameOptions}
            onChange={(next) => {
              setUsername(next);
              setPage(1);
            }}
          />
        </AdminField>
        <AdminField label={t("admin.auditStoreFilter")}>
          <div className="space-y-2">
            <input
              type="search"
              value={storeSearch}
              onChange={(event) => setStoreSearch(event.target.value)}
              placeholder={t("admin.auditStoreSearch")}
              className={adminInputClass}
              aria-label={t("admin.auditStoreSearch")}
            />
            <MenuSelect
              label={t("admin.auditStoreFilter")}
              value={storeName}
              options={storeOptions}
              onChange={(next) => {
                setStoreName(next);
                setPage(1);
              }}
            />
          </div>
        </AdminField>
        <AdminField label={t("admin.perPage")}>
          <MenuSelect
            label={t("admin.perPage")}
            value={String(pageSize)}
            options={PAGE_SIZES.map((size) => ({
              value: String(size),
              label: String(size),
            }))}
            onChange={(next) => {
              setPageSize(Number(next));
              setPage(1);
            }}
          />
        </AdminField>
        <AdminField label={t("admin.dateFrom")}>
          <input
            type="date"
            className={adminInputClass}
            value={dateFrom}
            onChange={(event) => {
              setDateFrom(event.target.value);
              setPage(1);
            }}
          />
        </AdminField>
        <AdminField label={t("admin.dateTo")}>
          <input
            type="date"
            className={adminInputClass}
            value={dateTo}
            onChange={(event) => {
              setDateTo(event.target.value);
              setPage(1);
            }}
          />
        </AdminField>
        <AdminField label={t("admin.timeFrom")}>
          <input
            type="time"
            className={adminInputClass}
            value={timeFrom}
            onChange={(event) => {
              setTimeFrom(event.target.value);
              setPage(1);
            }}
          />
        </AdminField>
        <AdminField label={t("admin.timeTo")}>
          <input
            type="time"
            className={adminInputClass}
            value={timeTo}
            onChange={(event) => {
              setTimeTo(event.target.value);
              setPage(1);
            }}
          />
        </AdminField>
        <AdminField label={t("admin.auditIpFilter")}>
          <input
            type="text"
            className={adminInputClass}
            value={ip}
            onChange={(event) => {
              setIp(event.target.value);
              setPage(1);
            }}
            placeholder={t("admin.auditIpPlaceholder")}
          />
        </AdminField>
      </div>

      <form className="flex min-w-0 flex-wrap gap-2" onSubmit={onSearch}>
        <SearchField
          value={search}
          onChange={setSearch}
          placeholder={t("admin.auditSearchPlaceholder")}
          inputClassName={adminSearchInputClass}
          className="min-w-[12rem] flex-1"
        />
        <button
          type="submit"
          className="rounded-xl border border-primary bg-transparent px-4 py-2 text-sm font-medium text-primary"
        >
          {t("common.search")}
        </button>
        <button
          type="button"
          onClick={() => void clearFilters()}
          className="rounded-xl border border-input-border px-4 py-2 text-sm font-medium"
        >
          {t("admin.clearFilters")}
        </button>
        <button
          type="button"
          onClick={() => void loadAuditLog()}
          className="rounded-xl border border-input-border px-4 py-2 text-sm font-medium"
        >
          {t("admin.refresh")}
        </button>
      </form>

      {error ? (
        <p className="rounded-xl border border-danger-border bg-danger/5 px-4 py-3 text-sm text-error">
          {error}
        </p>
      ) : null}

      <div className="overflow-x-auto rounded-xl border border-card-border">
        {loading ? (
          <LoadingSpinnerBlock wrapperClassName="flex justify-center p-6" />
        ) : entries.length === 0 ? (
          <p className="p-6 text-sm text-muted">{t("admin.noAuditEntries")}</p>
        ) : (
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-card-border bg-transparent text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">{t("admin.auditWhen")}</th>
                <th className="px-4 py-3 font-medium">{t("admin.eventType")}</th>
                <th className="px-4 py-3 font-medium">{t("admin.userLabel")}</th>
                <th className="px-4 py-3 font-medium">{t("common.additionalInfo")}</th>
                <th className="px-4 py-3 font-medium">IP</th>
                <th className="px-4 py-3 font-medium">{t("admin.device")}</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id} className="border-b border-card-border last:border-0">
                  <td className="px-4 py-3 text-foreground">
                    <span className="whitespace-nowrap">{formatDate(entry.occurredAt)}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${eventClass(entry.event)}`}
                    >
                      {formatEvent(entry.event)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-foreground">{entry.username}</td>
                  <td className="max-w-md px-4 py-3 text-muted" title={entry.details || undefined}>
                    {entry.details || "—"}
                  </td>
                  <td className="break-all px-4 py-3 text-muted">
                    {entry.ipAddress || "—"}
                  </td>
                  <td className="max-w-[10rem] px-4 py-3 text-muted">{entry.deviceInfo || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className={adminPaginationClass}>
        <p className="text-sm text-muted">
          {total === 0
            ? t("admin.noAuditEntries")
            : t("admin.showingEntries", { start, end, total })}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm text-muted">
            {t("admin.pageOf", { page: safePage, totalPages })}
          </p>
          <button
            type="button"
            disabled={safePage <= 1}
            onClick={() => setPage((value) => Math.max(1, value - 1))}
            className="rounded-lg border border-input-border px-3 py-1.5 text-sm disabled:opacity-40"
          >
            {t("admin.previous")}
          </button>
          <button
            type="button"
            disabled={safePage >= totalPages}
            onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
            className="rounded-lg border border-input-border px-3 py-1.5 text-sm disabled:opacity-40"
          >
            {t("admin.next")}
          </button>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AdminEmptyState,
  adminDangerButtonClass,
  adminPaginationClass,
  adminSearchInputClass,
} from "@/components/admin/admin-ui";
import { PrimaryButton } from "@/components/auth-forms";
import { MenuSelect } from "@/components/menu-select";
import { SearchField } from "@/components/search-field";
import { useT } from "@/components/i18n-provider";
import type { Client } from "@/components/admin/clients-panel";

type UserRow = {
  id: string;
  username: string;
  email: string | null;
  role: "ADMIN" | "USER";
  active: boolean;
  clientId: string | null;
  clientRole: "OWNER" | "MEMBER" | null;
  client: { id: string; name: string } | null;
  stores: { id: string; name: string; clientId: string }[];
};

type Store = { id: string; name: string };

type AssignmentState = {
  username: string;
  clientId: string;
  storeIds: string[];
  active: boolean;
  clientRole: "OWNER" | "MEMBER" | null;
  email: string;
};

type Props = {
  clients: Client[];
  onRefresh: () => void;
};

function assignmentFromUser(user: UserRow): AssignmentState {
  return {
    username: user.username,
    clientId: user.clientId ?? "",
    storeIds: user.stores.map((store) => store.id).sort(),
    active: user.active,
    clientRole: user.clientRole,
    email: user.email ?? "",
  };
}

function assignmentIsDirty(current: AssignmentState, saved: AssignmentState | null) {
  if (!saved) return false;
  return (
    current.username !== saved.username ||
    current.clientId !== saved.clientId ||
    current.active !== saved.active ||
    current.clientRole !== saved.clientRole ||
    current.email !== saved.email ||
    current.storeIds.join(",") !== saved.storeIds.join(",")
  );
}

export function UsersPanel({ clients, onRefresh }: Props) {
  const { t } = useT();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [username, setUsername] = useState("");
  const [clientId, setClientId] = useState("");
  const [storeIds, setStoreIds] = useState<string[]>([]);
  const [active, setActive] = useState(true);
  const [clientRole, setClientRole] = useState<"OWNER" | "MEMBER" | null>(null);
  const [email, setEmail] = useState("");
  const [clientStores, setClientStores] = useState<Store[]>([]);
  const [savedAssignment, setSavedAssignment] = useState<AssignmentState | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState("");

  const loadUsers = useCallback(async () => {
    const params = new URLSearchParams({
      page: String(page),
      pageSize: "20",
    });
    if (query) params.set("q", query);

    const response = await fetch(`/api/admin/users?${params}`);
    const data = await response.json();
    const list = (data.users ?? []) as UserRow[];
    setUsers(list);
    setTotal(data.total ?? 0);
    setTotalPages(data.totalPages ?? 1);
    return list;
  }, [page, query]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  async function loadClientStores(nextClientId: string) {
    if (!nextClientId) {
      setClientStores([]);
      return;
    }
    const response = await fetch(`/api/admin/stores?clientId=${nextClientId}`);
    const data = await response.json();
    setClientStores(data.stores ?? []);
  }

  function selectUser(user: UserRow) {
    const snapshot = assignmentFromUser(user);
    setSelectedUserId(user.id);
    setUsername(snapshot.username);
    setClientId(snapshot.clientId);
    setStoreIds(snapshot.storeIds);
    setActive(snapshot.active);
    setClientRole(snapshot.clientRole);
    setEmail(snapshot.email);
    setSavedAssignment(snapshot);
    setSaveMessage("");
    setPassword("");
    setConfirmPassword("");
    setPasswordMessage("");
    void loadClientStores(snapshot.clientId);
  }

  async function onClientChange(nextClientId: string) {
    setClientId(nextClientId);
    setStoreIds([]);
    if (!nextClientId) setClientRole(null);
    await loadClientStores(nextClientId);
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPage(1);
      setQuery(search.trim());
    }, 180);
    return () => window.clearTimeout(timer);
  }, [search]);

  const currentAssignment: AssignmentState = {
    username,
    clientId,
    storeIds: [...storeIds].sort(),
    active,
    clientRole,
    email,
  };
  const assignmentDirty = assignmentIsDirty(currentAssignment, savedAssignment);

  useEffect(() => {
    if (assignmentDirty && saveMessage === t("admin.saveSuccess")) {
      setSaveMessage("");
    }
  }, [assignmentDirty, saveMessage, t]);

  async function saveAssignment() {
    if (!selectedUserId || !assignmentDirty) return;
    setSaving(true);
    setSaveMessage("");
    try {
      const response = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: selectedUserId,
          username: username.trim(),
          clientId: clientId || null,
          storeIds,
          active,
          clientRole: clientId ? clientRole : null,
          email: email.trim() || null,
        }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setSaveMessage(data.error ?? t("errors.saveFailed"));
        return;
      }
      const list = await loadUsers();
      const updated = list.find((user) => user.id === selectedUserId);
      if (updated) {
        const snapshot = assignmentFromUser(updated);
        setUsername(snapshot.username);
        setClientId(snapshot.clientId);
        setStoreIds(snapshot.storeIds);
        setActive(snapshot.active);
        setClientRole(snapshot.clientRole);
        setEmail(snapshot.email);
        setSavedAssignment(snapshot);
        await loadClientStores(snapshot.clientId);
      }
      setSaveMessage(t("admin.saveSuccess"));
      onRefresh();
    } finally {
      setSaving(false);
    }
  }

  async function deleteUser() {
    if (!selectedUserId || selectedUser?.role === "ADMIN") return;
    if (!confirm(t("admin.confirmDeleteUser"))) return;

    const response = await fetch(
      `/api/admin/users?userId=${encodeURIComponent(selectedUserId)}`,
      { method: "DELETE" },
    );
    const data = (await response.json()) as { error?: string };
    if (!response.ok) {
      setSaveMessage(data.error ?? t("errors.saveFailed"));
      return;
    }

    setSelectedUserId(null);
    setSavedAssignment(null);
    setSaveMessage("");
    await loadUsers();
    onRefresh();
  }

  async function setUserPassword() {
    if (!selectedUserId || passwordSaving) return;
    if (password !== confirmPassword) {
      setPasswordMessage(t("auth.passwordMismatch"));
      return;
    }
    if (password.length < 6) {
      setPasswordMessage(t("auth.passwordTooShort"));
      return;
    }
    if (password.length > 72) {
      setPasswordMessage(t("auth.passwordTooLong"));
      return;
    }

    setPasswordSaving(true);
    setPasswordMessage("");
    try {
      const response = await fetch("/api/admin/users/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: selectedUserId,
          password,
          confirmPassword,
        }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setPasswordMessage(data.error ?? t("errors.saveFailed"));
        return;
      }
      setPassword("");
      setConfirmPassword("");
      setPasswordMessage(t("admin.passwordSetSuccess"));
    } finally {
      setPasswordSaving(false);
    }
  }

  const selectedUser = users.find((user) => user.id === selectedUserId);
  const selectedClient = clients.find((client) => client.id === clientId);
  const safePage = Math.min(page, totalPages);

  return (
    <div className="grid min-w-0 gap-6 lg:grid-cols-2">
      <section className="min-w-0 rounded-2xl border border-card-border p-4">
        <h2 className="font-medium">{t("admin.allUsers")}</h2>
        <div className="mt-3 flex min-w-0 gap-2">
          <SearchField
            value={search}
            onChange={setSearch}
            placeholder={t("admin.usersSearchPlaceholder")}
            inputClassName={adminSearchInputClass}
          />
        </div>
        <div className="mt-3 max-h-[32rem] space-y-1.5 overflow-y-auto">
          {users.length === 0 ? (
            <AdminEmptyState message={t("admin.noUsersFound")} />
          ) : (
            users.map((user) => (
              <button
                key={user.id}
                type="button"
                onClick={() => selectUser(user)}
                className={`w-full rounded-xl border px-3 py-2 text-left ${selectedUserId === user.id ? "border-primary bg-selected" : "border-card-border"} ${!user.active ? "opacity-60" : ""}`}
              >
                <div className="flex items-center gap-2">
                  <p className="font-medium">{user.username}</p>
                  {user.clientRole === "OWNER" ? (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-primary">
                      {t("admin.ownerBadge")}
                    </span>
                  ) : null}
                </div>
                {user.email ? (
                  <p className="truncate text-xs text-muted">{user.email}</p>
                ) : null}
                <p className="text-xs text-muted">
                  {t("admin.clientRow", {
                    name: user.client?.name ?? t("common.none"),
                  })}
                </p>
              </button>
            ))
          )}
        </div>
        {totalPages > 1 ? (
          <div className={`mt-4 ${adminPaginationClass}`}>
            <p className="text-sm text-muted">
              {t("admin.pageOf", { page: safePage, totalPages })}
            </p>
            <div className="flex gap-2">
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
        ) : null}
        {total > 0 && totalPages <= 1 ? (
          <p className="mt-3 text-sm text-muted">
            {t("admin.usersTotal", { count: total })}
          </p>
        ) : null}
      </section>

      <section className="min-w-0 rounded-2xl border border-card-border p-4">
        <h2 className="font-medium">{t("admin.assignment")}</h2>
        {!selectedUser ? (
          <p className="mt-3 text-sm text-muted">{t("admin.selectUser")}</p>
        ) : (
          <div className="mt-3 space-y-3">
            <label className="block text-sm">
              {t("auth.username")}
              <input
                type="text"
                autoComplete="username"
                spellCheck={false}
                className="mt-1 w-full rounded-xl border border-input-border bg-input px-3 py-2 text-foreground"
                value={username}
                placeholder={t("team.usernamePlaceholder")}
                onChange={(event) => setUsername(event.target.value)}
              />
              <span className="mt-1 block text-xs text-muted">
                {t("auth.usernameHint")}
              </span>
            </label>
            <label className="block text-sm">
              {t("admin.emailLabel")}
              <input
                type="email"
                autoComplete="email"
                className="mt-1 w-full rounded-xl border border-input-border bg-input px-3 py-2 text-foreground"
                value={email}
                placeholder={t("auth.emailOptional")}
                onChange={(event) => setEmail(event.target.value)}
              />
            </label>
            {selectedClient?.homeUser ? (
              <p className="text-sm font-medium text-primary">{t("admin.homeUser")}</p>
            ) : null}
            <div>
              <p className="text-sm font-medium">{t("admin.clientLabel")}</p>
              <MenuSelect
                label={t("admin.clientLabel")}
                value={clientId}
                options={[
                  { value: "", label: t("admin.noClient") },
                  ...clients.map((client) => ({
                    value: client.id,
                    label: client.name,
                  })),
                ]}
                onChange={(next) => void onClientChange(next)}
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={active}
                onChange={(event) => setActive(event.target.checked)}
              />
              {t("admin.activeUser")}
            </label>
            {selectedUser.role !== "ADMIN" && clientId ? (
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={clientRole === "OWNER"}
                  onChange={(event) =>
                    setClientRole(event.target.checked ? "OWNER" : "MEMBER")
                  }
                />
                <span>
                  <span className="font-medium">{t("admin.clientOwner")}</span>
                  <span className="mt-0.5 block text-xs text-muted">
                    {t("admin.clientOwnerHint")}
                  </span>
                </span>
              </label>
            ) : null}
            <div>
              <p className="text-sm font-medium">{t("admin.storesLabel")}</p>
              <div className="mt-2 space-y-1">
                {clientStores.length === 0 ? (
                  <p className="text-xs text-muted">{t("admin.noStoresYet")}</p>
                ) : (
                  clientStores.map((store) => (
                    <label key={store.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={storeIds.includes(store.id)}
                        onChange={(event) => {
                          setStoreIds((current) =>
                            event.target.checked
                              ? [...current, store.id]
                              : current.filter((id) => id !== store.id),
                          );
                        }}
                      />
                      {store.name}
                    </label>
                  ))
                )}
              </div>
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
            <PrimaryButton
              disabled={!assignmentDirty || saving}
              onClick={() => void saveAssignment()}
            >
              {saving ? t("admin.saving") : t("common.save")}
            </PrimaryButton>

            <div className="space-y-2 border-t border-card-border pt-3">
              <h3 className="text-sm font-medium text-foreground">
                {t("admin.setPassword")}
              </h3>
              <p className="text-xs text-muted">{t("admin.setPasswordHint")}</p>
              <label className="block text-sm">
                {t("auth.password")}
                <input
                  type="password"
                  autoComplete="new-password"
                  className="mt-1 w-full rounded-xl border border-input-border bg-input px-3 py-2 text-foreground"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </label>
              <label className="block text-sm">
                {t("auth.confirmPassword")}
                <input
                  type="password"
                  autoComplete="new-password"
                  className="mt-1 w-full rounded-xl border border-input-border bg-input px-3 py-2 text-foreground"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                />
              </label>
              {passwordMessage ? (
                <p
                  className={`text-sm ${
                    passwordMessage === t("admin.passwordSetSuccess")
                      ? "text-emerald-700"
                      : "text-error"
                  }`}
                >
                  {passwordMessage}
                </p>
              ) : null}
              <PrimaryButton
                disabled={
                  passwordSaving || !password.trim() || !confirmPassword.trim()
                }
                onClick={() => void setUserPassword()}
              >
                {passwordSaving
                  ? t("admin.saving")
                  : t("admin.setPasswordButton")}
              </PrimaryButton>
            </div>

            {selectedUser.role !== "ADMIN" ? (
              <button
                type="button"
                className={`w-full ${adminDangerButtonClass}`}
                onClick={() => void deleteUser()}
              >
                {t("common.delete")}
              </button>
            ) : null}
          </div>
        )}
      </section>
    </div>
  );
}

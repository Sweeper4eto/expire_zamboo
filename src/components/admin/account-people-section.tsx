"use client";

import { useEffect, useState } from "react";
import {
  AdminEmptyState,
  AdminField,
  adminInputClass,
} from "@/components/admin/admin-ui";
import { PrimaryButton } from "@/components/auth-forms";
import { MenuSelect } from "@/components/menu-select";
import { useT } from "@/components/i18n-provider";

type UserRow = {
  id: string;
  username: string;
  email: string | null;
  role: "ADMIN" | "USER";
  active: boolean;
  clientId: string | null;
  clientRole: "OWNER" | "MEMBER" | null;
  stores: { id: string; name: string }[];
};

type Store = { id: string; name: string; active: boolean };

type Props = {
  clientId: string;
  stores: Store[];
  onChanged: () => void;
};

export function AccountPeopleSection({ clientId, stores, onChanged }: Props) {
  const { t } = useT();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [username, setUsername] = useState("");
  const [storeIds, setStoreIds] = useState<string[]>([]);
  const [clientRole, setClientRole] = useState<"OWNER" | "MEMBER">("MEMBER");
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [assignQuery, setAssignQuery] = useState("");
  const [candidates, setCandidates] = useState<UserRow[]>([]);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setSelectedId(null);
    setMessage("");
    void (async () => {
      const response = await fetch(
        `/api/admin/users?clientId=${encodeURIComponent(clientId)}&pageSize=50`,
      );
      const data = (await response.json()) as { users?: UserRow[] };
      if (!cancelled) setUsers(data.users ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, [clientId, reloadToken]);

  function reloadUsers() {
    setReloadToken((n) => n + 1);
  }

  useEffect(() => {
    const q = assignQuery.trim();
    if (q.length < 2) {
      setCandidates([]);
      return;
    }
    const timer = window.setTimeout(() => {
      void (async () => {
        const response = await fetch(
          `/api/admin/users?q=${encodeURIComponent(q)}&pageSize=20`,
        );
        const data = (await response.json()) as { users?: UserRow[] };
        setCandidates(
          (data.users ?? []).filter(
            (user) => user.role !== "ADMIN" && user.clientId !== clientId,
          ),
        );
      })();
    }, 200);
    return () => window.clearTimeout(timer);
  }, [assignQuery, clientId]);

  function selectUser(user: UserRow) {
    setSelectedId(user.id);
    setUsername(user.username);
    setStoreIds(user.stores.map((store) => store.id));
    setClientRole(user.clientRole === "OWNER" ? "OWNER" : "MEMBER");
    setActive(user.active);
    setMessage("");
  }

  async function saveUser() {
    if (!selectedId) return;
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: selectedId,
          username: username.trim(),
          clientId,
          storeIds,
          active,
          clientRole,
        }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setMessage(data.error ?? t("errors.saveFailed"));
        return;
      }
      setMessage(t("admin.saveSuccess"));
      reloadUsers();
      onChanged();
    } finally {
      setSaving(false);
    }
  }

  async function assignUser(userId: string) {
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          clientId,
          storeIds: stores.filter((store) => store.active).map((store) => store.id),
          clientRole: "MEMBER",
          active: true,
        }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setMessage(data.error ?? t("errors.saveFailed"));
        return;
      }
      setAssignQuery("");
      setCandidates([]);
      setMessage(t("admin.saveSuccess"));
      reloadUsers();
      onChanged();
    } finally {
      setSaving(false);
    }
  }

  const selected = users.find((user) => user.id === selectedId);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {users.length === 0 ? (
          <AdminEmptyState message={t("admin.accountNoPeople")} />
        ) : (
          users.map((user) => (
            <button
              key={user.id}
              type="button"
              onClick={() => selectUser(user)}
              className={`flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-left text-sm ${
                selectedId === user.id
                  ? "border-primary bg-selected"
                  : "border-card-border"
              } ${!user.active ? "opacity-60" : ""}`}
            >
              <span className="min-w-0">
                <span className="block font-semibold text-foreground">
                  {user.username}
                </span>
                <span className="text-xs text-muted">
                  {user.clientRole === "OWNER"
                    ? t("admin.ownerBadge")
                    : t("team.member")}
                  {" · "}
                  {user.stores.length > 0
                    ? user.stores.map((store) => store.name).join(", ")
                    : t("admin.noStoresYet")}
                </span>
              </span>
              <span className="text-xs text-primary">{t("common.edit")}</span>
            </button>
          ))
        )}
      </div>

      {selected ? (
        <div className="space-y-3 rounded-xl border border-card-border p-3">
          <AdminField label={t("auth.username")}>
            <input
              className={adminInputClass}
              value={username}
              spellCheck={false}
              autoComplete="username"
              placeholder={t("team.usernamePlaceholder")}
              onChange={(event) => setUsername(event.target.value)}
            />
            <span className="mt-1 block text-xs text-muted">
              {t("auth.usernameHint")}
            </span>
          </AdminField>
          <AdminField label={t("team.role")}>
            <MenuSelect
              label={t("team.role")}
              value={clientRole}
              options={[
                { value: "OWNER", label: t("admin.ownerBadge") },
                { value: "MEMBER", label: t("team.member") },
              ]}
              onChange={(value) => setClientRole(value as "OWNER" | "MEMBER")}
            />
          </AdminField>
          <div>
            <p className="mb-2 text-xs text-muted">{t("admin.clientStores")}</p>
            <div className="space-y-1.5">
              {stores.map((store) => {
                const checked = storeIds.includes(store.id);
                return (
                  <label
                    key={store.id}
                    className="flex items-center gap-2 text-sm text-foreground"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() =>
                        setStoreIds((current) =>
                          checked
                            ? current.filter((id) => id !== store.id)
                            : [...current, store.id],
                        )
                      }
                    />
                    {store.name}
                    {!store.active ? (
                      <span className="text-xs text-muted">
                        ({t("admin.locationDisabled")})
                      </span>
                    ) : null}
                  </label>
                );
              })}
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={active}
              onChange={(event) => setActive(event.target.checked)}
            />
            {t("admin.activeUser")}
          </label>
          <PrimaryButton disabled={saving} onClick={() => void saveUser()}>
            {saving ? t("admin.saving") : t("common.save")}
          </PrimaryButton>
        </div>
      ) : null}

      <div className="space-y-2 rounded-xl border border-card-border p-3">
        <p className="text-sm font-semibold text-foreground">
          {t("admin.accountAssignUser")}
        </p>
        <AdminField label={t("admin.usersSearchPlaceholder")}>
          <input
            className={adminInputClass}
            value={assignQuery}
            onChange={(event) => setAssignQuery(event.target.value)}
            placeholder={t("admin.usersSearchPlaceholder")}
          />
        </AdminField>
        {candidates.map((user) => (
          <button
            key={user.id}
            type="button"
            disabled={saving}
            onClick={() => void assignUser(user.id)}
            className="flex w-full items-center justify-between rounded-lg border border-card-border px-3 py-2 text-left text-sm"
          >
            <span>
              {user.username}
              {user.clientId ? (
                <span className="ml-2 text-xs text-muted">
                  ({t("admin.accountAlreadyOnClient")})
                </span>
              ) : null}
            </span>
            <span className="text-xs text-primary">{t("admin.accountAssign")}</span>
          </button>
        ))}
      </div>

      {message ? <p className="text-sm text-primary">{message}</p> : null}
    </div>
  );
}

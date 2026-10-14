"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  AdminNavId,
  AdminShell,
  type AdminNavItem,
} from "@/components/admin/admin-ui";
import { AuditLogPanel } from "@/components/admin/audit-log-panel";
import { ClientsPanel, type Client } from "@/components/admin/clients-panel";
import { DocumentOcrUsagePanel } from "@/components/admin/document-ocr-usage-panel";
import { ItemsPanel } from "@/components/admin/items-panel";
import { MinimartLocatorPanel } from "@/components/admin/minimart-locator-panel";
import { PaymentsPanel } from "@/components/admin/payments-panel";
import { SupportRequestsPanel } from "@/components/admin/support-requests-panel";
import { UsersPanel } from "@/components/admin/users-panel";
import { WhatsNewPanel } from "@/components/admin/whats-new-panel";
import { AppHeaderLogo } from "@/components/app-header-logo";
import { useT } from "@/components/i18n-provider";
import { logoutSession } from "@/lib/client-session";

type HubSection = "overview" | "locations" | "people" | "billing" | "newStore";

export default function AdminPage() {
  const router = useRouter();
  const { t } = useT();
  const [tab, setTab] = useState<AdminNavId>("accounts");
  const [clients, setClients] = useState<Client[]>([]);
  const [supportNewCount, setSupportNewCount] = useState(0);
  const [openClientId, setOpenClientId] = useState<string | null>(null);
  const [openSection, setOpenSection] = useState<HubSection | null>(null);

  const refreshClients = useCallback(async () => {
    const response = await fetch("/api/admin/clients");
    const data = await response.json();
    setClients(data.clients ?? []);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      const response = await fetch("/api/admin/clients");
      const data = await response.json();
      if (!cancelled) setClients(data.clients ?? []);
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadSupportCount() {
      try {
        const response = await fetch(
          "/api/admin/support/requests?status=new&take=1",
        );
        const data = await response.json().catch(() => null);
        if (cancelled) return;
        setSupportNewCount(data?.counts?.new ?? 0);
      } catch {
        if (!cancelled) setSupportNewCount(0);
      }
    }
    void loadSupportCount();
    return () => {
      cancelled = true;
    };
  }, []);

  async function logout() {
    await logoutSession();
    router.push("/login");
    router.refresh();
  }

  function openAccountBilling(clientId: string, homeUser?: boolean) {
    const fromList = clients.find((client) => client.id === clientId);
    const isHome = homeUser ?? fromList?.homeUser ?? false;
    setOpenClientId(clientId);
    setOpenSection("billing");
    setTab(isHome ? "household" : "accounts");
  }

  const navItems: AdminNavItem[] = [
    { id: "accounts", label: t("admin.accounts"), group: "primary" },
    { id: "household", label: t("admin.householdNav"), group: "primary" },
    { id: "payments", label: t("admin.payments"), group: "primary" },
    {
      id: "support",
      label: t("support.navLabel"),
      group: "primary",
      badge: supportNewCount > 0 ? supportNewCount : undefined,
    },
    { id: "items", label: t("admin.items"), group: "secondary" },
    { id: "whatsNew", label: t("admin.whatsNewTab"), group: "secondary" },
    {
      id: "minimart",
      label: t("admin.minimartLocatorTab"),
      group: "secondary",
    },
    {
      id: "ocrUsage",
      label: t("admin.documentOcrUsageTab"),
      group: "secondary",
    },
    { id: "audit", label: t("admin.auditLog"), group: "secondary" },
  ];

  const usersSlot = (
    <UsersPanel clients={clients} onRefresh={() => void refreshClients()} />
  );

  return (
    <div className="min-h-full bg-background">
      <div className="mx-auto min-w-0 max-w-7xl overflow-x-visible px-3 pb-4 pt-[max(1rem,env(safe-area-inset-top,0px))] sm:px-4 md:px-6 md:pb-6 md:pt-[max(1.5rem,env(safe-area-inset-top,0px))]">
        <header className="mb-4 flex flex-wrap items-start justify-between gap-3 lg:mb-6">
          <div className="min-w-0 lg:hidden">
            <AppHeaderLogo size={40} />
            <p className="mt-1.5 text-sm text-muted">{t("admin.panel")}</p>
          </div>
          <div className="hidden min-w-0 lg:block">
            <p className="text-sm text-muted">{t("admin.panel")}</p>
            <h1 className="text-xl font-semibold text-foreground">
              {t("common.appName")}
            </h1>
          </div>
          <button
            type="button"
            onClick={() => void logout()}
            className="rounded-xl border border-input-border px-4 py-2 text-sm font-medium text-foreground hover:bg-transparent"
          >
            {t("common.logout")}
          </button>
        </header>

        <AdminShell
          brand={
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                {t("admin.panel")}
              </p>
              <AppHeaderLogo size={36} />
            </div>
          }
          signedInAs={t("admin.signedInAsAdmin")}
          items={navItems}
          active={tab}
          onChange={setTab}
        >
          {tab === "accounts" || tab === "household" ? (
            <ClientsPanel
              accountKind={tab === "household" ? "household" : "business"}
              supportNewCount={supportNewCount}
              onRefresh={() => void refreshClients()}
              openClientId={openClientId}
              openSection={openSection}
              onOpenConsumed={() => {
                setOpenClientId(null);
                setOpenSection(null);
              }}
              usersSlot={usersSlot}
            />
          ) : null}
          {tab === "payments" ? (
            <PaymentsPanel onOpenAccount={openAccountBilling} />
          ) : null}
          {tab === "items" ? <ItemsPanel /> : null}
          {tab === "support" ? (
            <SupportRequestsPanel
              onCounts={(counts) => setSupportNewCount(counts.new)}
            />
          ) : null}
          {tab === "whatsNew" ? <WhatsNewPanel /> : null}
          {tab === "minimart" ? <MinimartLocatorPanel /> : null}
          {tab === "ocrUsage" ? <DocumentOcrUsagePanel /> : null}
          {tab === "audit" ? <AuditLogPanel /> : null}
        </AdminShell>
      </div>
    </div>
  );
}

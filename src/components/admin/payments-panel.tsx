"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PrimaryButton } from "@/components/auth-forms";
import {
  AdminField,
  adminInputClass,
} from "@/components/admin/admin-ui";
import { useT } from "@/components/i18n-provider";
import { MenuSelect } from "@/components/menu-select";
import { appButtonNeutral } from "@/lib/app-ui";
import type { PaymentStanding } from "@/lib/payment-status";

type CalendarRow = {
  client: {
    id: string;
    name: string;
    locationsFeeTotal: number;
    paymentsRequired?: boolean;
  };
  activeStoreCount: number;
  expectedAmount: number;
  paid: boolean;
  payment: {
    discount: number;
    amountPaid: number;
    activeStoreCount: number;
    notes: string | null;
  } | null;
};

type StatusRow = {
  client: {
    id: string;
    name: string;
    active: boolean;
    homeUser: boolean;
    paymentsRequired: boolean;
    locationsFeeTotal: number;
  };
  activeStoreCount: number;
  storeCount: number;
  expectedAmount: number;
  unpaidMonths: number;
  standing: PaymentStanding;
};

type ClientDetail = {
  client: StatusRow["client"] & { createdAt?: string };
  stores: { id: string; name: string; active: boolean; monthlyFee?: number }[];
  activeStoreCount: number;
  locationsFeeTotal?: number;
  expectedAmount: number;
  unpaidMonths: number;
  standing: PaymentStanding;
  payments: {
    id: string;
    year: number;
    month: number;
    amountPaid: number;
    discount: number;
    notes: string | null;
    paidAt: string;
  }[];
};

type ViewMode = "clients" | "month";
type AccountFilter = "business" | "household" | "all";

function periodKey(year: number, month: number) {
  return `${year}-${month}`;
}

const PAYMENT_ZERO_CARD =
  "border-[var(--urgency-warning-border)] bg-warning-bg";

function nothingToPay(options: {
  expectedAmount: number;
  paymentsRequired?: boolean;
  homeUser?: boolean;
  activeStoreCount?: number;
}): boolean {
  if (options.homeUser) return true;
  if (options.paymentsRequired === false) return true;
  if ((options.activeStoreCount ?? 1) <= 0) return true;
  return options.expectedAmount <= 0;
}

function standingRowClass(
  standing: PaymentStanding,
  selected: boolean,
  options?: {
    expectedAmount: number;
    paymentsRequired: boolean;
    homeUser: boolean;
    activeStoreCount: number;
  },
): string {
  const ring = selected ? "ring-2 ring-primary" : "";
  if (
    options &&
    nothingToPay({
      expectedAmount: options.expectedAmount,
      paymentsRequired: options.paymentsRequired,
      homeUser: options.homeUser,
      activeStoreCount: options.activeStoreCount,
    })
  ) {
    return `${PAYMENT_ZERO_CARD} ${ring}`;
  }
  switch (standing) {
    case "current":
      return `border-success-border bg-success-bg ${ring}`;
    case "behind1":
      return `border-card-border bg-transparent ${ring}`;
    case "behind2plus":
      return `border-danger-border bg-red-950/40 ${ring}`;
    case "exempt":
      return `${PAYMENT_ZERO_CARD} ${ring}`;
  }
}

function monthCardClass(row: CalendarRow, selected: boolean): string {
  const ring = selected ? "ring-2 ring-primary" : "";
  if (
    nothingToPay({
      expectedAmount: row.expectedAmount,
      paymentsRequired: row.client.paymentsRequired,
      activeStoreCount: row.activeStoreCount,
    })
  ) {
    return `${PAYMENT_ZERO_CARD} ${ring}`;
  }
  if (row.paid) {
    return `border-success-border bg-success-bg ${ring}`;
  }
  return `border-card-border ${ring}`;
}

export function PaymentsPanel({
  onOpenAccount,
}: {
  onOpenAccount?: (clientId: string, homeUser?: boolean) => void;
} = {}) {
  const { t, monthName } = useT();
  const now = new Date();
  const [view, setView] = useState<ViewMode>("clients");
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [rows, setRows] = useState<CalendarRow[]>([]);
  const [statusRows, setStatusRows] = useState<StatusRow[]>([]);
  const [accountFilter, setAccountFilter] = useState<AccountFilter>("business");
  const [clientQuery, setClientQuery] = useState("");
  const [selectedClientId, setSelectedClientId] = useState("");
  const [detail, setDetail] = useState<ClientDetail | null>(null);
  const [discount, setDiscount] = useState("0");
  const [notes, setNotes] = useState("");
  const [savedPayment, setSavedPayment] = useState({ discount: "0", notes: "" });
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [markYear, setMarkYear] = useState(now.getFullYear());
  const [markMonth, setMarkMonth] = useState(now.getMonth() + 1);

  const currency = t("common.currency");

  const loadStatusList = useCallback(async () => {
    const response = await fetch("/api/admin/payments?status=1");
    const data = (await response.json()) as { rows?: StatusRow[] };
    setStatusRows(data.rows ?? []);
  }, []);

  const loadCalendar = useCallback(async () => {
    const response = await fetch(
      `/api/admin/payments/calendar?year=${year}&month=${month}&calendar=1`,
    );
    const data = await response.json();
    setRows(data.rows ?? []);
  }, [year, month]);

  const loadClientDetail = useCallback(
    async (clientId: string) => {
      const response = await fetch(
        `/api/admin/payments?clientId=${encodeURIComponent(clientId)}`,
      );
      if (!response.ok) {
        setDetail(null);
        return;
      }
      const data = (await response.json()) as ClientDetail;
      setDetail(data);
      const paidThis = data.payments.find(
        (p) => p.year === markYear && p.month === markMonth,
      );
      const nextDiscount = String(paidThis?.discount ?? 0);
      const nextNotes = paidThis?.notes ?? "";
      setDiscount(nextDiscount);
      setNotes(nextNotes);
      setSavedPayment({ discount: nextDiscount, notes: nextNotes });
    },
    [markMonth, markYear],
  );

  useEffect(() => {
    void loadStatusList();
  }, [loadStatusList]);

  useEffect(() => {
    if (view === "month") void loadCalendar();
  }, [view, loadCalendar]);

  useEffect(() => {
    if (view === "clients" && selectedClientId) {
      void loadClientDetail(selectedClientId);
    }
  }, [view, selectedClientId, loadClientDetail]);

  const filteredStatusRows = useMemo(() => {
    const q = clientQuery.trim().toLowerCase();
    return statusRows.filter((row) => {
      if (accountFilter === "business" && row.client.homeUser) return false;
      if (accountFilter === "household" && !row.client.homeUser) return false;
      if (q && !row.client.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [statusRows, clientQuery, accountFilter]);

  useEffect(() => {
    if (
      selectedClientId &&
      !filteredStatusRows.some((row) => row.client.id === selectedClientId)
    ) {
      setSelectedClientId("");
      setDetail(null);
    }
  }, [filteredStatusRows, selectedClientId]);

  function standingLabel(
    row: {
      standing: PaymentStanding;
      unpaidMonths: number;
      expectedAmount: number;
      client: { homeUser: boolean; paymentsRequired: boolean };
    },
  ) {
    if (row.client.homeUser) return t("admin.paymentsHomeExempt");
    if (!row.client.paymentsRequired) return t("admin.paymentsRequiredOff");
    if (row.expectedAmount <= 0) return t("admin.paymentStandingFree");
    switch (row.standing) {
      case "current":
        return t("admin.paymentStandingCurrent");
      case "behind1":
        return t("admin.paymentStandingBehind1");
      case "behind2plus":
        return t("admin.paymentStandingBehindN", { count: row.unpaidMonths });
      case "exempt":
        return t("admin.paymentsHomeExempt");
    }
  }

  function shiftMonth(delta: number) {
    const date = new Date(year, month - 1 + delta, 1);
    setYear(date.getFullYear());
    setMonth(date.getMonth() + 1);
  }

  function selectMonthClient(id: string) {
    const row = rows.find((entry) => entry.client.id === id);
    const nextDiscount = String(row?.payment?.discount ?? 0);
    const nextNotes = row?.payment?.notes ?? "";
    setSelectedClientId(id);
    setDiscount(nextDiscount);
    setNotes(nextNotes);
    setSavedPayment({ discount: nextDiscount, notes: nextNotes });
    setMarkYear(year);
    setMarkMonth(month);
    setSaveMessage("");
  }

  function selectClient(id: string) {
    setSelectedClientId(id);
    setMarkYear(now.getFullYear());
    setMarkMonth(now.getMonth() + 1);
    setSaveMessage("");
  }

  const selectedMonthRow = rows.find((row) => row.client.id === selectedClientId);
  const paymentDirty =
    view === "month"
      ? Boolean(selectedMonthRow) &&
        (!selectedMonthRow?.paid ||
          discount !== savedPayment.discount ||
          notes !== savedPayment.notes)
      : Boolean(detail) &&
        (discount !== savedPayment.discount ||
          notes !== savedPayment.notes ||
          !detail?.payments.some(
            (p) => p.year === markYear && p.month === markMonth,
          ));

  async function refreshAfterPaymentChange() {
    if (view === "month") await loadCalendar();
    else {
      await loadStatusList();
      if (selectedClientId) await loadClientDetail(selectedClientId);
    }
  }

  async function markPaid() {
    if (!selectedClientId || !paymentDirty) return;
    setSaving(true);
    setSaveMessage("");
    try {
      const response = await fetch("/api/admin/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: selectedClientId,
          year: view === "month" ? year : markYear,
          month: view === "month" ? month : markMonth,
          discount: Number(discount) || 0,
          notes: notes || undefined,
        }),
      });
      if (!response.ok) {
        setSaveMessage(t("errors.saveFailed"));
        return;
      }
      await refreshAfterPaymentChange();
      setSavedPayment({ discount, notes });
      setSaveMessage(t("admin.saveSuccess"));
    } finally {
      setSaving(false);
    }
  }

  async function unmarkPaid(y: number, m: number) {
    if (!selectedClientId) return;
    if (!window.confirm(t("admin.confirmUnmarkPayment"))) return;
    setSaving(true);
    setSaveMessage("");
    try {
      const response = await fetch(
        `/api/admin/payments?clientId=${encodeURIComponent(selectedClientId)}&year=${y}&month=${m}`,
        { method: "DELETE" },
      );
      if (!response.ok) {
        setSaveMessage(t("errors.saveFailed"));
        return;
      }
      await refreshAfterPaymentChange();
      setSaveMessage(t("admin.saveSuccess"));
    } finally {
      setSaving(false);
    }
  }

  const paidKeys = useMemo(() => {
    const set = new Set<string>();
    for (const payment of detail?.payments ?? []) {
      set.add(periodKey(payment.year, payment.month));
    }
    return set;
  }, [detail]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-1.5">
        {(
          [
            ["clients", t("admin.paymentsViewClients")],
            ["month", t("admin.paymentsViewMonth")],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setView(id)}
            className={`${appButtonNeutral} ${
              view === id ? "border-primary text-primary" : ""
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {view === "clients" ? (
        <div className="space-y-4">
          <section className="rounded-2xl border border-card-border p-4">
            <p className="text-sm text-muted">{t("admin.paymentsPortfolioHint")}</p>
            <div className="mt-3 flex flex-wrap gap-3 text-xs">
              <span className="rounded-lg border border-success-border bg-success-bg px-2 py-1">
                {t("admin.paymentStandingCurrent")}
              </span>
              <span className="rounded-lg border border-card-border px-2 py-1">
                {t("admin.paymentStandingBehind1")}
              </span>
              <span className="rounded-lg border border-danger-border bg-red-950/40 px-2 py-1 text-error">
                {t("admin.paymentStandingBehind2plus")}
              </span>
            </div>
            <div className="mt-4 flex flex-wrap gap-1.5">
              {(
                [
                  ["business", t("auth.accountTypeRetail")],
                  ["household", t("auth.accountTypeHome")],
                  ["all", t("admin.paymentFilterAll")],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setAccountFilter(id)}
                  className={`${appButtonNeutral} ${
                    accountFilter === id ? "border-primary text-primary" : ""
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="mt-3">
              <AdminField label={t("common.search")}>
                <input
                  value={clientQuery}
                  onChange={(event) => setClientQuery(event.target.value)}
                  className={adminInputClass}
                  placeholder={t("admin.searchPlaceholder")}
                />
              </AdminField>
            </div>
            <div className="mt-3 space-y-1.5">
              {filteredStatusRows.length === 0 ? (
                <p className="text-sm text-muted">{t("admin.noClientsFound")}</p>
              ) : (
                filteredStatusRows.map((row) => (
                  <button
                    key={row.client.id}
                    type="button"
                    onClick={() => selectClient(row.client.id)}
                    className={`flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-left text-sm ${standingRowClass(
                      row.standing,
                      selectedClientId === row.client.id,
                      {
                        expectedAmount: row.expectedAmount,
                        paymentsRequired: row.client.paymentsRequired,
                        homeUser: row.client.homeUser,
                        activeStoreCount: row.activeStoreCount,
                      },
                    )} ${!row.client.active ? "opacity-60" : ""}`}
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-semibold text-foreground">
                        {row.client.name}
                      </span>
                      <span className="text-xs text-muted">
                        {row.client.homeUser
                          ? t("admin.homeUser")
                          : t("admin.paymentClientStores", {
                              active: row.activeStoreCount,
                              total: row.storeCount,
                              amount: row.expectedAmount.toFixed(2),
                              currency,
                            })}
                      </span>
                    </span>
                    <span
                      className={`shrink-0 text-xs font-semibold ${
                        row.standing === "behind2plus"
                          ? "text-error"
                          : "text-foreground"
                      }`}
                    >
                      {standingLabel(row)}
                    </span>
                  </button>
                ))
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-card-border p-4">
            {!detail ? (
              <p className="text-sm text-muted">{t("admin.selectClient")}</p>
            ) : (
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold text-foreground">
                    {detail.client.name}
                  </h3>
                  <p
                    className={`mt-1 text-sm font-semibold ${
                      detail.standing === "behind2plus"
                        ? "text-error"
                        : "text-muted"
                    }`}
                  >
                    {standingLabel(detail)}
                  </p>
                  <p className="mt-1 text-sm text-muted">
                    {t("admin.expectedAmount", {
                      amount: detail.expectedAmount.toFixed(2),
                      currency,
                      stores: detail.activeStoreCount,
                      fee: (
                        detail.locationsFeeTotal ??
                        detail.client.locationsFeeTotal
                      ).toFixed(2),
                    })}
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    {t("admin.paymentCoversAllStores")}
                  </p>
                  {onOpenAccount ? (
                    <button
                      type="button"
                      className="mt-3 text-sm font-semibold text-primary"
                      onClick={() =>
                        onOpenAccount(
                          detail.client.id,
                          detail.client.homeUser,
                        )
                      }
                    >
                      {t("admin.openAccountBilling")}
                    </button>
                  ) : null}
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <AdminField label={t("admin.billingMonth")}>
                    <MenuSelect
                      label={t("admin.billingMonth")}
                      value={String(markMonth)}
                      options={Array.from({ length: 12 }, (_, i) => {
                        const m = i + 1;
                        return { value: String(m), label: monthName(m) };
                      })}
                      onChange={(value) => setMarkMonth(Number(value))}
                      buttonClassName={`${adminInputClass} flex items-center justify-between gap-2 text-left`}
                    />
                  </AdminField>
                  <AdminField label={t("admin.billingYear")}>
                    <input
                      type="number"
                      className={adminInputClass}
                      value={markYear}
                      onChange={(event) =>
                        setMarkYear(Number(event.target.value) || markYear)
                      }
                    />
                  </AdminField>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <input
                    className={adminInputClass}
                    placeholder={t("admin.discountPlaceholder", { currency })}
                    value={discount}
                    onChange={(event) => setDiscount(event.target.value)}
                  />
                  <input
                    className={adminInputClass}
                    placeholder={t("admin.notesPlaceholder")}
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                  />
                </div>

                <p className="text-sm text-muted">
                  {t("admin.finalAmount", {
                    amount: Math.max(
                      0,
                      detail.expectedAmount - (Number(discount) || 0),
                    ).toFixed(2),
                    currency,
                  })}
                </p>

                <div className="flex flex-wrap gap-2">
                  <PrimaryButton
                    disabled={!paymentDirty || saving}
                    onClick={() => void markPaid()}
                  >
                    {saving ? t("admin.saving") : t("admin.markAsPaid")}
                  </PrimaryButton>
                  {paidKeys.has(periodKey(markYear, markMonth)) ? (
                    <button
                      type="button"
                      disabled={saving}
                      className="rounded-xl border border-danger-border px-4 py-2 text-sm font-medium text-error disabled:opacity-50"
                      onClick={() => void unmarkPaid(markYear, markMonth)}
                    >
                      {t("admin.unmarkPayment")}
                    </button>
                  ) : null}
                </div>

                <div>
                  <h4 className="mb-2 text-sm font-semibold text-foreground">
                    {t("admin.paymentHistory")}
                  </h4>
                  {detail.payments.length === 0 ? (
                    <p className="text-sm text-muted">{t("admin.noPaymentsYet")}</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {detail.payments.map((payment) => (
                        <li
                          key={payment.id}
                          className="flex items-center justify-between gap-2 rounded-xl border border-success-border bg-success-bg px-3 py-2 text-sm"
                        >
                          <span>
                            {monthName(payment.month)} {payment.year}
                          </span>
                          <span className="tabular-nums">
                            {payment.amountPaid.toFixed(2)} {currency}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}
          </section>
        </div>
      ) : (
        <>
          <section className="rounded-2xl border border-card-border p-4">
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                className="shrink-0 rounded-lg border border-input-border bg-transparent px-3 py-2 text-foreground"
                onClick={() => shiftMonth(-1)}
              >
                ←
              </button>
              <h2 className="min-w-0 flex-1 text-center text-lg font-medium">
                {monthName(month)} {year}
              </h2>
              <button
                type="button"
                className="shrink-0 rounded-lg border border-input-border bg-transparent px-3 py-2 text-foreground"
                onClick={() => shiftMonth(1)}
              >
                →
              </button>
            </div>
            <p className="mt-2 text-sm text-muted">{t("admin.paymentFormula")}</p>

            <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {rows.map((row) => (
                <button
                  key={row.client.id}
                  type="button"
                  onClick={() => selectMonthClient(row.client.id)}
                  className={`rounded-xl border p-3 text-left ${monthCardClass(
                    row,
                    selectedClientId === row.client.id,
                  )}`}
                >
                  <p className="font-medium">{row.client.name}</p>
                  <p className="text-xs text-muted">
                    {t("admin.activeCount", {
                      count: row.activeStoreCount,
                      amount: row.expectedAmount.toFixed(2),
                      currency,
                    })}
                  </p>
                  <p className="text-xs font-medium text-foreground">
                    {row.paid
                      ? t("admin.paid", {
                          amount: row.payment?.amountPaid.toFixed(2) ?? "0",
                          currency,
                        })
                      : t("admin.unpaid")}
                  </p>
                </button>
              ))}
            </div>
          </section>

          {selectedMonthRow ? (
            <section className="rounded-2xl border border-card-border p-4">
              <h3 className="font-medium">
                {t("admin.markPayment", { name: selectedMonthRow.client.name })}
              </h3>
              <p className="mt-1 text-sm text-muted">
                {t("admin.expectedAmount", {
                  amount: selectedMonthRow.expectedAmount.toFixed(2),
                  currency,
                  stores: selectedMonthRow.activeStoreCount,
                  fee: selectedMonthRow.client.locationsFeeTotal.toFixed(2),
                })}
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <input
                  className={adminInputClass}
                  placeholder={t("admin.discountPlaceholder", { currency })}
                  value={discount}
                  onChange={(event) => setDiscount(event.target.value)}
                />
                <input
                  className={adminInputClass}
                  placeholder={t("admin.notesPlaceholder")}
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                />
              </div>
              <p className="mt-2 text-sm text-muted">
                {t("admin.finalAmount", {
                  amount: Math.max(
                    0,
                    selectedMonthRow.expectedAmount - (Number(discount) || 0),
                  ).toFixed(2),
                  currency,
                })}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <PrimaryButton
                  disabled={!paymentDirty || saving}
                  onClick={() => void markPaid()}
                >
                  {saving ? t("admin.saving") : t("admin.markAsPaid")}
                </PrimaryButton>
                {selectedMonthRow.paid ? (
                  <button
                    type="button"
                    disabled={saving}
                    className="rounded-xl border border-danger-border px-4 py-2 text-sm font-medium text-error disabled:opacity-50"
                    onClick={() => void unmarkPaid(year, month)}
                  >
                    {t("admin.unmarkPayment")}
                  </button>
                ) : null}
              </div>
            </section>
          ) : null}
        </>
      )}

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
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { AdminField, adminInputClass } from "@/components/admin/admin-ui";
import { PrimaryButton } from "@/components/auth-forms";
import { useT } from "@/components/i18n-provider";
import { MenuSelect } from "@/components/menu-select";
import type { PaymentStanding } from "@/lib/payment-status";

type StoreFeeRow = {
  id: string;
  name: string;
  active: boolean;
  monthlyFee: number;
};

type ReferralRow = { id: string; name: string };

type ClientDetail = {
  client: {
    id: string;
    name: string;
    homeUser: boolean;
    paymentsRequired: boolean;
    locationsFeeTotal: number;
  };
  stores: StoreFeeRow[];
  referrals: ReferralRow[];
  activeStoreCount: number;
  expectedAmount: number;
  unpaidMonths: number;
  standing: PaymentStanding;
  payments: {
    id: string;
    year: number;
    month: number;
    amountPaid: number;
  }[];
};

type Props = {
  clientId: string;
  onChanged: () => void;
};

function periodKey(year: number, month: number) {
  return `${year}-${month}`;
}

export function AccountBillingSection({ clientId, onChanged }: Props) {
  const { t, monthName } = useT();
  const currency = t("common.currency");
  const now = new Date();
  const [detail, setDetail] = useState<ClientDetail | null>(null);
  const [paymentsRequired, setPaymentsRequired] = useState(false);
  const [discount, setDiscount] = useState("0");
  const [notes, setNotes] = useState("");
  const [markYear, setMarkYear] = useState(now.getFullYear());
  const [markMonth, setMarkMonth] = useState(now.getMonth() + 1);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setMessage("");
    void (async () => {
      const response = await fetch(`/api/admin/payments?clientId=${clientId}`);
      const data = (await response.json()) as ClientDetail;
      if (cancelled) return;
      if (!data?.client) {
        setDetail(null);
        return;
      }
      setDetail(data);
      setPaymentsRequired(Boolean(data.client.paymentsRequired));
    })();
    return () => {
      cancelled = true;
    };
  }, [clientId, reloadToken]);

  function reload() {
    setReloadToken((n) => n + 1);
  }

  const paidKeys = useMemo(() => {
    const set = new Set<string>();
    for (const payment of detail?.payments ?? []) {
      set.add(periodKey(payment.year, payment.month));
    }
    return set;
  }, [detail]);

  async function saveBillingSettings() {
    if (!detail || detail.client.homeUser) return;
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/clients", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: clientId,
          paymentsRequired,
        }),
      });
      if (!response.ok) {
        setMessage(t("errors.saveFailed"));
        return;
      }
      setMessage(t("admin.saveSuccess"));
      reload();
      onChanged();
    } finally {
      setSaving(false);
    }
  }

  async function markPaid() {
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          year: markYear,
          month: markMonth,
          discount: Number(discount) || 0,
          notes: notes.trim() || undefined,
        }),
      });
      if (!response.ok) {
        setMessage(t("errors.saveFailed"));
        return;
      }
      setDiscount("0");
      setNotes("");
      setMessage(t("admin.saveSuccess"));
      reload();
      onChanged();
    } finally {
      setSaving(false);
    }
  }

  async function unmarkPaid(year: number, month: number) {
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch(
        `/api/admin/payments?clientId=${clientId}&year=${year}&month=${month}`,
        { method: "DELETE" },
      );
      if (!response.ok) {
        setMessage(t("errors.saveFailed"));
        return;
      }
      setMessage(t("admin.saveSuccess"));
      reload();
      onChanged();
    } finally {
      setSaving(false);
    }
  }

  if (!detail) {
    return <p className="text-sm text-muted">{t("common.loading")}</p>;
  }

  const standingLabel = (() => {
    if (detail.client.homeUser) return t("admin.paymentsHomeExempt");
    if (!detail.client.paymentsRequired) return t("admin.paymentsRequiredOff");
    if (detail.expectedAmount <= 0) return t("admin.paymentStandingFree");
    switch (detail.standing) {
      case "current":
        return t("admin.paymentStandingCurrent");
      case "behind1":
        return t("admin.paymentStandingBehind1");
      case "behind2plus":
        return t("admin.paymentStandingBehindN", { count: detail.unpaidMonths });
      default:
        return t("admin.paymentsHomeExempt");
    }
  })();

  return (
    <div className="space-y-4">
      <div>
        <p
          className={`text-sm font-semibold ${
            detail.standing === "behind2plus" ? "text-error" : "text-foreground"
          }`}
        >
          {standingLabel}
        </p>
        <p className="mt-1 text-sm text-muted">
          {t("admin.expectedAmount", {
            amount: detail.expectedAmount.toFixed(2),
            currency,
            stores: detail.activeStoreCount,
            fee: detail.client.locationsFeeTotal.toFixed(2),
          })}
        </p>
        {!detail.client.homeUser && detail.stores.length > 0 ? (
          <ul className="mt-2 space-y-1 text-xs text-muted">
            {detail.stores.map((store) => (
              <li key={store.id} className={!store.active ? "opacity-50" : ""}>
                {store.name}
                {!store.active ? ` (${t("admin.locationDisabled")})` : ""}
                {": "}
                <span className="tabular-nums text-foreground">
                  {store.monthlyFee.toFixed(2)} {currency}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
        <p className="mt-1 text-xs text-muted">{t("admin.feePerStoreHint")}</p>
      </div>

      {detail.client.homeUser ? (
        <p className="text-sm text-muted">{t("admin.paymentsHomeExempt")}</p>
      ) : (
        <div className="space-y-3 rounded-xl border border-card-border p-3">
          <label className="flex items-center justify-between gap-3 text-sm">
            <span>
              <span className="block font-semibold text-foreground">
                {t("admin.paymentsRequired")}
              </span>
              <span className="mt-0.5 block text-xs text-muted">
                {t("admin.paymentsRequiredHint")}
              </span>
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={paymentsRequired}
              disabled={saving}
              onClick={() => setPaymentsRequired((value) => !value)}
              className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
                paymentsRequired
                  ? "bg-primary"
                  : "border border-card-border bg-transparent"
              }`}
            >
              <span
                aria-hidden
                className={`absolute top-0.5 size-6 rounded-full bg-white transition-transform ${
                  paymentsRequired ? "left-5" : "left-0.5"
                }`}
              />
            </button>
          </label>
          <PrimaryButton
            disabled={
              saving || paymentsRequired === detail.client.paymentsRequired
            }
            onClick={() => void saveBillingSettings()}
          >
            {saving ? t("admin.saving") : t("common.save")}
          </PrimaryButton>
        </div>
      )}

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
        <div className="space-y-2">
          <input
            className={adminInputClass}
            placeholder={t("admin.discountPlaceholder", { currency })}
            value={discount}
            onChange={(event) => setDiscount(event.target.value)}
          />
          {!detail.client.homeUser ? (
            <div className="rounded-xl border border-card-border bg-selected/20 px-3 py-2">
              <p className="text-xs font-semibold text-foreground">
                {t("admin.referralsCount", {
                  count: detail.referrals.length,
                })}
              </p>
              {detail.referrals.length === 0 ? (
                <p className="mt-1 text-xs text-muted">
                  {t("admin.referralsEmpty")}
                </p>
              ) : (
                <ul className="mt-1 space-y-0.5 text-xs text-muted">
                  {detail.referrals.map((row) => (
                    <li key={row.id}>{row.name}</li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}
        </div>
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
        <PrimaryButton disabled={saving} onClick={() => void markPaid()}>
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

      {message ? <p className="text-sm text-primary">{message}</p> : null}
    </div>
  );
}

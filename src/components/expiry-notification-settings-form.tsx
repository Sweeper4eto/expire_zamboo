"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { LoadingSpinnerBlock } from "@/components/loading-spinner";
import { MobilePageHeader, appPageClassName } from "@/components/mobile-page-header";
import { MenuSelect } from "@/components/menu-select";
import { NotifyTimeSelect } from "@/components/notify-time-select";
import { useT } from "@/components/i18n-provider";
import { appButtonPrimaryFull, appFormInput } from "@/lib/app-ui";
import type { ExpiryNotificationPrefs } from "@/lib/expiry-notification-prefs";
import { snapTimeToStep } from "@/lib/expiry-notification-prefs";
import {
  buildTimezoneOptions,
  detectBrowserTimezone,
  resolveTimezoneForForm,
} from "@/lib/timezones";

type StoreOption = { id: string; name: string };

type SettingsResponse = ExpiryNotificationPrefs & { stores: StoreOption[] };

const DAY_PRESETS = [3, 7, 14] as const;

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
        checked ? "bg-primary" : "border border-card-border bg-transparent"
      }`}
    >
      <span
        aria-hidden
        className={`absolute top-0.5 size-6 rounded-full bg-white transition-transform ${
          checked ? "left-5" : "left-0.5"
        }`}
      />
    </button>
  );
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-card-border p-4">
      <h2 className="mb-2 text-sm font-semibold text-foreground">{title}</h2>
      {hint ? <p className="mb-3 text-xs leading-snug text-muted">{hint}</p> : null}
      {children}
    </section>
  );
}

function DayChips({
  value,
  onChange,
  customLabel,
  daysLabel,
}: {
  value: number;
  onChange: (days: number) => void;
  customLabel: string;
  daysLabel: string;
}) {
  const [custom, setCustom] = useState(
    !DAY_PRESETS.includes(value as (typeof DAY_PRESETS)[number]),
  );

  const chipClass = (active: boolean) =>
    `rounded-full border px-3 py-2 text-center text-xs font-medium ${
      active
        ? "border-primary/45 bg-primary/10 text-primary"
        : "border-card-border text-muted"
    }`;

  return (
    <div className="mt-3 space-y-2">
      <div className="grid grid-cols-2 gap-2">
        {DAY_PRESETS.map((days) => (
          <button
            key={days}
            type="button"
            onClick={() => {
              setCustom(false);
              onChange(days);
            }}
            className={chipClass(!custom && value === days)}
          >
            {days} {daysLabel}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setCustom(true)}
          className={chipClass(custom)}
        >
          {customLabel}
        </button>
      </div>
      {custom ? (
        <input
          type="number"
          min={0}
          max={90}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
          className={`${appFormInput} w-full px-3 py-2 text-center text-sm`}
          aria-label={customLabel}
        />
      ) : null}
    </div>
  );
}

export function ExpiryNotificationSettingsForm() {
  const { t } = useT();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [stores, setStores] = useState<StoreOption[]>([]);
  const [prefs, setPrefs] = useState<ExpiryNotificationPrefs | null>(null);
  const [storeMode, setStoreMode] = useState<"all" | "selected">("all");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/push/notification-settings");
      const data = (await response.json().catch(() => null)) as {
        settings?: SettingsResponse;
        error?: string;
      } | null;
      if (!response.ok || !data?.settings) {
        setError(data?.error ?? t("pushSettings.loadError"));
        return;
      }
      const next = data.settings;
      const detected = detectBrowserTimezone();
      setStores(next.stores);
      setPrefs({
        earlyEnabled: next.earlyEnabled,
        earlyDays: next.earlyDays,
        urgentEnabled: next.urgentEnabled,
        urgentDays: next.urgentDays,
        schedule: next.schedule,
        time1: next.time1,
        time2: next.time2,
        minIntervalHours: next.minIntervalHours,
        quietHoursEnabled: false,
        quietHoursStart: next.quietHoursStart,
        quietHoursEnd: next.quietHoursEnd,
        timezone: resolveTimezoneForForm(
          next.customized,
          next.timezone,
          detected,
        ),
        storeIds: next.storeIds,
        customized: next.customized,
      });
      setStoreMode(next.storeIds && next.storeIds.length > 0 ? "selected" : "all");
    } catch {
      setError(t("pushSettings.loadError"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  function patch(partial: Partial<ExpiryNotificationPrefs>) {
    setPrefs((current) => (current ? { ...current, ...partial } : current));
  }

  function toggleStore(id: string) {
    setPrefs((current) => {
      if (!current) return current;
      const selected = new Set(current.storeIds ?? []);
      if (selected.has(id)) selected.delete(id);
      else selected.add(id);
      return { ...current, storeIds: [...selected] };
    });
  }

  async function save() {
    if (!prefs) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const payload = {
        ...prefs,
        schedule: "daily" as const,
        storeIds: storeMode === "all" ? null : prefs.storeIds ?? [],
      };
      const response = await fetch("/api/push/notification-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await response.json().catch(() => null)) as {
        settings?: SettingsResponse;
        error?: string;
      } | null;
      if (!response.ok || !data?.settings) {
        setError(data?.error ?? t("pushSettings.saveError"));
        return;
      }
      setMessage(t("pushSettings.saved"));
      setPrefs({ ...data.settings, customized: true });
    } catch {
      setError(t("pushSettings.saveError"));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className={appPageClassName}>
        <MobilePageHeader title={t("pushSettings.title")} />
        <LoadingSpinnerBlock />
      </div>
    );
  }

  if (!prefs) {
    return (
      <div className={appPageClassName}>
        <MobilePageHeader title={t("pushSettings.title")} />
        <p className="text-sm text-danger">{error || t("pushSettings.loadError")}</p>
        <Link href="/app" className="mt-4 inline-block text-sm text-primary">
          ← {t("common.back")}
        </Link>
      </div>
    );
  }

  const detectedTimezone = detectBrowserTimezone();
  const timezoneOptions = buildTimezoneOptions(
    detectedTimezone,
    prefs.timezone,
    (zone, isDetected) =>
      isDetected ? t("pushSettings.timezoneAuto", { zone }) : zone,
  );

  return (
    <div className={appPageClassName}>
      <MobilePageHeader
        title={t("pushSettings.title")}
        action={
          <Link href="/app" className="text-sm text-primary">
            {t("common.back")}
          </Link>
        }
      />

      <div className="space-y-3 pb-8">
        <Section title={t("pushSettings.tiers")} hint={t("pushSettings.tiersHint")}>
          <div className="rounded-xl border border-primary/35 bg-primary/5 p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-primary">{t("pushSettings.earlyTitle")}</p>
              </div>
              <Toggle
                checked={prefs.earlyEnabled}
                onChange={(earlyEnabled) => patch({ earlyEnabled })}
                label={t("pushSettings.earlyTitle")}
              />
            </div>
            <DayChips
              value={prefs.earlyDays}
              onChange={(earlyDays) => patch({ earlyDays })}
              customLabel={t("pushSettings.customDays")}
              daysLabel={t("pushSettings.daysLabel")}
            />
            {prefs.earlyEnabled ? (
              <div className="mt-3">
                <NotifyTimeSelect
                  label={t("pushSettings.timeLabel")}
                  value={prefs.time1}
                  onChange={(time1) => patch({ time1: snapTimeToStep(time1) })}
                />
              </div>
            ) : null}
          </div>

          <div className="mt-3 rounded-xl border border-danger/40 bg-danger/5 p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-danger">{t("pushSettings.urgentTitle")}</p>
              </div>
              <Toggle
                checked={prefs.urgentEnabled}
                onChange={(urgentEnabled) => patch({ urgentEnabled })}
                label={t("pushSettings.urgentTitle")}
              />
            </div>
            <DayChips
              value={prefs.urgentDays}
              onChange={(urgentDays) => patch({ urgentDays })}
              customLabel={t("pushSettings.customDays")}
              daysLabel={t("pushSettings.daysLabel")}
            />
            {prefs.urgentEnabled ? (
              <div className="mt-3">
                <NotifyTimeSelect
                  label={t("pushSettings.timeLabel")}
                  value={prefs.time2}
                  onChange={(time2) => patch({ time2: snapTimeToStep(time2) })}
                />
              </div>
            ) : null}
          </div>
        </Section>

        <Section title={t("pushSettings.timezone")} hint={t("pushSettings.timezoneHint")}>
          <MenuSelect
            label={t("pushSettings.timezone")}
            value={prefs.timezone}
            options={timezoneOptions}
            onChange={(timezone) => patch({ timezone })}
          />
        </Section>

        <Section title={t("pushSettings.stores")}>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setStoreMode("all")}
              className={`rounded-full border px-3 py-2 text-center text-xs font-medium ${
                storeMode === "all"
                  ? "border-primary/45 bg-primary/10 text-primary"
                  : "border-card-border text-muted"
              }`}
            >
              {t("pushSettings.storesAll")}
            </button>
            <button
              type="button"
              onClick={() => setStoreMode("selected")}
              className={`rounded-full border px-3 py-2 text-center text-xs font-medium ${
                storeMode === "selected"
                  ? "border-primary/45 bg-primary/10 text-primary"
                  : "border-card-border text-muted"
              }`}
            >
              {t("pushSettings.storesSelected")}
            </button>
          </div>
          {storeMode === "selected" ? (
            <ul className="mt-3 space-y-2">
              {stores.map((store) => {
                const checked = prefs.storeIds?.includes(store.id) ?? false;
                return (
                  <li key={store.id}>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleStore(store.id)}
                        className="size-4 accent-primary"
                      />
                      {store.name}
                    </label>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </Section>

        {error ? <p className="text-sm text-danger">{error}</p> : null}
        {message ? <p className="text-sm text-primary">{message}</p> : null}

        <button
          type="button"
          disabled={saving}
          onClick={() => void save()}
          className={appButtonPrimaryFull}
        >
          {saving ? t("admin.saving") : t("pushSettings.save")}
        </button>
      </div>
    </div>
  );
}

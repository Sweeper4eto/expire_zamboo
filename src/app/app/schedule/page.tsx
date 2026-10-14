"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { ActionFlash } from "@/components/action-flash";
import { LoadingSpinnerBlock } from "@/components/loading-spinner";
import { MobilePageHeader } from "@/components/mobile-page-header";
import { ChevronRightIcon, SaveDiskIcon } from "@/components/app-nav-icons";
import { useAppSession } from "@/components/app-session-provider";
import { useT } from "@/components/i18n-provider";
import { useAppStoreId } from "@/hooks/use-app-store-id";
import { CancelButton } from "@/components/cancel-button";
import {
  appButtonNeutralFull,
  appButtonPrimaryFull,
  appChromeInset,
  appListInset,
  appPageShell,
} from "@/lib/app-ui";
import {
  SCHEDULE_CLOSE_MIN,
  SCHEDULE_OPEN_MIN,
  SCHEDULE_SPAN_MIN,
  SCHEDULE_STEP_MIN,
  addDaysYmd,
  clampScheduleMinutes,
  formatDurationMinutes,
  formatMinutesAsClock,
  mondayOfWeek,
  parseYmd,
} from "@/lib/schedule";
import {
  downloadScheduleWeekPng,
  openScheduleWeekPrint,
  type ScheduleWeekPrintLabels,
} from "@/lib/schedule-week-print";
import { useViewportInsets } from "@/hooks/use-viewport-insets";

type Staff = {
  id: string;
  username: string;
  displayName?: string | null;
  clientRole: string | null;
};
type Shift = {
  id: string;
  userId: string;
  dayIndex: number;
  startMin: number;
  endMin: number;
};
type DayState = {
  dayIndex: number;
  mode: "auto" | "manual";
  status: "DRAFT" | "FINALIZED";
  finalizedAt: string | null;
  excludedUserIds: string[];
};
type WeekPayload = {
  week: {
    id: string;
    storeId: string;
    weekStart: string;
  };
  days: DayState[];
  staff: Staff[];
  shifts: Shift[];
  me: { userId: string; isOwner: boolean };
};

const DAY_LABELS = [
  "schedule.dayMon",
  "schedule.dayTue",
  "schedule.dayWed",
  "schedule.dayThu",
  "schedule.dayFri",
  "schedule.daySat",
  "schedule.daySun",
] as const;

const DAY_FULL_LABELS = [
  "schedule.dayMonFull",
  "schedule.dayTueFull",
  "schedule.dayWedFull",
  "schedule.dayThuFull",
  "schedule.dayFriFull",
  "schedule.daySatFull",
  "schedule.daySunFull",
] as const;


function initials(username: string): string {
  const parts = username.trim().split(/[\s._-]+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
  }
  return username.slice(0, 2).toUpperCase() || "?";
}

function leftPct(startMin: number): number {
  return ((startMin - SCHEDULE_OPEN_MIN) / SCHEDULE_SPAN_MIN) * 100;
}

function widthPct(startMin: number, endMin: number): number {
  return ((endMin - startMin) / SCHEDULE_SPAN_MIN) * 100;
}

function mergeCoverageRanges(
  ranges: { startMin: number; endMin: number }[],
): { startMin: number; endMin: number }[] {
  const sorted = [...ranges]
    .filter((r) => r.endMin > r.startMin)
    .sort((a, b) => a.startMin - b.startMin);
  const merged: { startMin: number; endMin: number }[] = [];
  for (const range of sorted) {
    const last = merged[merged.length - 1];
    if (!last || range.startMin > last.endMin) {
      merged.push({ ...range });
    } else {
      last.endMin = Math.max(last.endMin, range.endMin);
    }
  }
  return merged;
}

function coveredMinutes(
  ranges: { startMin: number; endMin: number }[],
): number {
  return ranges.reduce((sum, r) => sum + (r.endMin - r.startMin), 0);
}

function DayCoverageBar({
  ranges,
  hoursUnit,
  minutesUnit,
  labelFull,
  labelPartial,
  labelEmpty,
}: {
  ranges: { startMin: number; endMin: number }[];
  hoursUnit: string;
  minutesUnit: string;
  labelFull: string;
  labelPartial: string;
  labelEmpty: string;
}) {
  const merged = mergeCoverageRanges(ranges);
  const covered = coveredMinutes(merged);
  const full = covered >= SCHEDULE_SPAN_MIN;
  const empty = covered <= 0;
  const coveredLabel = formatDurationLabel(covered, hoursUnit, minutesUnit);
  const totalLabel = formatDurationLabel(
    SCHEDULE_SPAN_MIN,
    hoursUnit,
    minutesUnit,
  );
  const status = full
    ? labelFull
    : empty
      ? labelEmpty
      : labelPartial
          .replace("{covered}", coveredLabel)
          .replace("{total}", totalLabel);

  return (
    <div className="mb-2">
      <div className="mb-1 flex items-center justify-between gap-2">
        <p
          className={`min-w-0 text-xs font-semibold ${
            full ? "text-primary" : "text-muted"
          }`}
        >
          {status}
        </p>
        <p className="shrink-0 text-[0.65rem] tabular-nums text-muted">
          {formatMinutesAsClock(SCHEDULE_OPEN_MIN)}–
          {formatMinutesAsClock(SCHEDULE_CLOSE_MIN)}
        </p>
      </div>
      <div className="relative h-3 overflow-hidden rounded-full border border-card-border bg-card-border/25">
        {merged.map((range) => (
          <div
            key={`${range.startMin}-${range.endMin}`}
            aria-hidden
            className={`absolute top-0 bottom-0 ${
              full ? "bg-primary" : "bg-primary/75"
            }`}
            style={{
              left: `${leftPct(range.startMin)}%`,
              width: `${widthPct(range.startMin, range.endMin)}%`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

function minutesFromClientX(
  track: HTMLDivElement | null,
  clientX: number,
): number {
  if (!track) return SCHEDULE_OPEN_MIN;
  const rect = track.getBoundingClientRect();
  const pct = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
  return clampScheduleMinutes(SCHEDULE_OPEN_MIN + pct * SCHEDULE_SPAN_MIN);
}

function formatDurationLabel(
  totalMin: number,
  hoursUnit: string,
  minutesUnit: string,
): string {
  return formatDurationMinutes(totalMin, hoursUnit, minutesUnit);
}

/**
 * Per-member day bar: green = assigned shift (owner can drag when editable).
 */
function MemberShiftBar({
  assigned,
  editable,
  disabled,
  onCommit,
  onLiveChange,
}: {
  assigned: { startMin: number; endMin: number } | null;
  editable: boolean;
  disabled?: boolean;
  onCommit: (startMin: number, endMin: number) => void;
  onLiveChange?: (startMin: number, endMin: number) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const dragWhich = useRef<"start" | "end" | null>(null);
  const [draft, setDraft] = useState(assigned);
  const draftRef = useRef(draft);
  const liveCb = useRef(onLiveChange);
  const onCommitRef = useRef(onCommit);

  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  useEffect(() => {
    liveCb.current = onLiveChange;
  }, [onLiveChange]);

  useEffect(() => {
    onCommitRef.current = onCommit;
  }, [onCommit]);

  const assignedStart = assigned?.startMin;
  const assignedEnd = assigned?.endMin;
  useEffect(() => {
    setDraft(
      assignedStart != null && assignedEnd != null
        ? { startMin: assignedStart, endMin: assignedEnd }
        : null,
    );
  }, [assignedStart, assignedEnd]);

  function applyDrag(which: "start" | "end", clientX: number) {
    const minutes = minutesFromClientX(trackRef.current, clientX);
    const current =
      draftRef.current ?? { startMin: 10 * 60, endMin: 16 * 60 };
    const next =
      which === "start"
        ? {
            startMin: Math.min(minutes, current.endMin - SCHEDULE_STEP_MIN),
            endMin: current.endMin,
          }
        : {
            startMin: current.startMin,
            endMin: Math.max(minutes, current.startMin + SCHEDULE_STEP_MIN),
          };
    draftRef.current = next;
    setDraft(next);
    liveCb.current?.(next.startMin, next.endMin);
  }

  function handlePointerMove(event: PointerEvent<HTMLButtonElement>) {
    const which = dragWhich.current;
    if (!which || !editable || disabled) return;
    applyDrag(which, event.clientX);
  }

  function handlePointerUp(event: PointerEvent<HTMLButtonElement>) {
    const which = dragWhich.current;
    dragWhich.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (which && draftRef.current) {
      onCommitRef.current(draftRef.current.startMin, draftRef.current.endMin);
    }
  }

  function handleStartDown(event: PointerEvent<HTMLButtonElement>) {
    if (!editable || disabled) return;
    event.preventDefault();
    dragWhich.current = "start";
    event.currentTarget.setPointerCapture(event.pointerId);
    applyDrag("start", event.clientX);
  }

  function handleEndDown(event: PointerEvent<HTMLButtonElement>) {
    if (!editable || disabled) return;
    event.preventDefault();
    dragWhich.current = "end";
    event.currentTarget.setPointerCapture(event.pointerId);
    applyDrag("end", event.clientX);
  }

  const show =
    draft ?? assigned ?? (editable ? { startMin: 10 * 60, endMin: 16 * 60 } : null);
  /** Green block is only a suggestion until a shift is saved / draft dragged. */
  const provisional = Boolean(editable && !assigned && !draft && show);

  return (
    <div ref={trackRef} className="relative h-6 touch-none select-none rounded-md border border-card-border/70 bg-transparent">
      {show ? (
        <div
          aria-hidden
          className={`absolute top-0.5 bottom-0.5 z-[1] rounded-sm border border-primary ${
            provisional
              ? "border-dashed bg-primary/15"
              : "bg-primary/35"
          }`}
          style={{
            left: `${leftPct(show.startMin)}%`,
            width: `${widthPct(show.startMin, show.endMin)}%`,
          }}
        />
      ) : null}
      {editable && show ? (
        <>
          <button
            type="button"
            disabled={disabled}
            aria-label="Start"
            className="absolute top-1/2 z-[3] size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-primary bg-background disabled:opacity-50"
            style={{ left: `${leftPct(show.startMin)}%` }}
            onPointerDown={handleStartDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          />
          <button
            type="button"
            disabled={disabled}
            aria-label="End"
            className="absolute top-1/2 z-[3] size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-primary bg-background disabled:opacity-50"
            style={{ left: `${leftPct(show.endMin)}%` }}
            onPointerDown={handleEndDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          />
        </>
      ) : null}
    </div>
  );
}

function formatShiftSummary(
  range: { startMin: number; endMin: number },
  hoursUnit: string,
  minutesUnit: string,
): string {
  const duration = formatDurationLabel(
    range.endMin - range.startMin,
    hoursUnit,
    minutesUnit,
  );
  return `${formatMinutesAsClock(range.startMin)}–${formatMinutesAsClock(range.endMin)} · ${duration}`;
}

function MemberHoursLabel({
  personId,
  assigned,
  liveByUser,
  hoursUnit,
  minutesUnit,
}: {
  personId: string;
  assigned: { startMin: number; endMin: number } | null;
  liveByUser: Record<string, { startMin: number; endMin: number }>;
  hoursUnit: string;
  minutesUnit: string;
}) {
  const live = liveByUser[personId];
  const range = live ?? assigned;
  if (range) {
    return (
      <span className="shrink-0 text-right text-xs tabular-nums text-muted">
        {formatShiftSummary(range, hoursUnit, minutesUnit)}
      </span>
    );
  }
  return (
    <span className="shrink-0 text-right text-xs tabular-nums text-muted">—</span>
  );
}

function SchedulePageInner() {
  const { t } = useT();
  const { storeId, ready: storeReady } = useAppStoreId();
  const { user: sessionUser } = useAppSession();
  const [weekStart, setWeekStart] = useState(() => mondayOfWeek());
  const [dayIndex, setDayIndex] = useState(() => {
    const d = new Date().getDay();
    return d === 0 ? 6 : d - 1;
  });
  const [data, setData] = useState<WeekPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveFormatOpen, setSaveFormatOpen] = useState(false);
  const [savingExport, setSavingExport] = useState(false);
  const [flashMessage, setFlashMessage] = useState<string | null>(null);
  const [liveHoursByUser, setLiveHoursByUser] = useState<
    Record<string, { startMin: number; endMin: number }>
  >({});
  const { offsetTop, keyboardInset } = useViewportInsets();
  const clearFlash = useCallback(() => setFlashMessage(null), []);

  /** Always land on the current week when opening the scheduler. */
  useEffect(() => {
    setWeekStart(mondayOfWeek());
    const d = new Date().getDay();
    setDayIndex(d === 0 ? 6 : d - 1);
  }, []);

  useEffect(() => {
    setLiveHoursByUser({});
  }, [weekStart, dayIndex]);

  const load = useCallback(async () => {
    if (!storeId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/schedule?storeId=${encodeURIComponent(storeId)}&weekStart=${encodeURIComponent(weekStart)}`,
      );
      const json = (await res.json()) as WeekPayload & { error?: string };
      if (!res.ok) {
        setError(json.error ?? t("schedule.loadFailed"));
        setData(null);
        return;
      }
      setData(json);
      setLiveHoursByUser({});
    } catch {
      setError(t("schedule.loadFailed"));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [storeId, weekStart, t]);

  useEffect(() => {
    if (!storeReady || !storeId) return;
    void load();
  }, [storeReady, storeId, load]);

  const dayShifts = useMemo(
    () =>
      (data?.shifts ?? [])
        .filter((s) => s.dayIndex === dayIndex)
        .sort((a, b) => a.startMin - b.startMin),
    [data, dayIndex],
  );

  const dayState = useMemo(() => {
    return (
      data?.days.find((d) => d.dayIndex === dayIndex) ?? {
        dayIndex,
        mode: "auto" as const,
        status: "DRAFT" as const,
        finalizedAt: null,
        excludedUserIds: [] as string[],
      }
    );
  }, [data, dayIndex]);

  const excludedToday = useMemo(
    () => new Set(dayState.excludedUserIds ?? []),
    [dayState.excludedUserIds],
  );

  const memberRows = useMemo(() => {
    if (!data) return [];
    const people = data.me.isOwner
      ? data.staff
      : data.staff.filter((p) => !excludedToday.has(p.id));
    return people.map((person) => {
      const shift = dayShifts.find((s) => s.userId === person.id) ?? null;
      return { person, shift };
    });
  }, [data, dayShifts, excludedToday]);

  const isFinalized = dayState.status === "FINALIZED";
  const isOwner = Boolean(data?.me.isOwner);
  /** Finalized day is locked for everyone until the owner taps Edit. */
  const readOnly = isFinalized;
  const ownerCanEditShifts = Boolean(isOwner && !readOnly);

  /**
   * Coverage follows who’s included today and the same ranges as the green
   * bars (saved / live / editable 10–16 placeholder).
   */
  const dayCoverageRanges = useMemo(() => {
    const ranges: { startMin: number; endMin: number }[] = [];
    for (const { person, shift } of memberRows) {
      if (excludedToday.has(person.id)) continue;
      const live = liveHoursByUser[person.id];
      const assigned = shift
        ? { startMin: shift.startMin, endMin: shift.endMin }
        : null;
      const effective =
        live ??
        assigned ??
        (ownerCanEditShifts
          ? { startMin: 10 * 60, endMin: 16 * 60 }
          : null);
      if (effective && effective.endMin > effective.startMin) {
        ranges.push(effective);
      }
    }
    return ranges;
  }, [memberRows, excludedToday, liveHoursByUser, ownerCanEditShifts]);

  const missingShiftCount = useMemo(() => {
    if (!ownerCanEditShifts) return 0;
    return memberRows.filter(
      ({ person, shift }) =>
        !excludedToday.has(person.id) &&
        !shift &&
        !liveHoursByUser[person.id],
    ).length;
  }, [memberRows, excludedToday, liveHoursByUser, ownerCanEditShifts]);

  async function ownerAction(
    action: "setMode" | "runAuto" | "finalize" | "reopen" | "setParticipant",
    mode?: "auto" | "manual",
    extra?: { userId: string; scheduleParticipant: boolean },
  ) {
    if (!storeId || !data) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/schedule", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeId,
          weekStart,
          dayIndex,
          action,
          mode,
          ...extra,
        }),
      });
      const json = (await res.json()) as WeekPayload & { error?: string };
      if (!res.ok) {
        setError(json.error ?? t("schedule.saveFailed"));
        return;
      }
      setData(json);
      setLiveHoursByUser({});
    } catch {
      setError(t("schedule.saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  async function saveMemberShift(
    userId: string,
    startMin: number,
    endMin: number,
  ) {
    if (!storeId || !data || !ownerCanEditShifts) return;
    const others = data.shifts
      .filter((s) => s.dayIndex === dayIndex && s.userId !== userId)
      .map((s) => ({
        userId: s.userId,
        dayIndex: s.dayIndex,
        startMin: s.startMin,
        endMin: s.endMin,
      }));
    const next = [
      ...others,
      { userId, dayIndex, startMin, endMin },
    ];
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/schedule", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeId,
          weekStart,
          dayIndex,
          action: "setShifts",
          shifts: next,
        }),
      });
      const json = (await res.json()) as WeekPayload & { error?: string };
      if (!res.ok) {
        setError(json.error ?? t("schedule.invalidBounds"));
        return;
      }
      setData(json);
      setLiveHoursByUser({});
    } catch {
      setError(t("schedule.saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  const weekLabel = useMemo(() => {
    const pad = (n: number) => String(n).padStart(2, "0");
    const start = parseYmd(weekStart);
    const end = parseYmd(addDaysYmd(weekStart, 6));
    return `${pad(start.getDate())}.${pad(start.getMonth() + 1)} – ${pad(end.getDate())}.${pad(end.getMonth() + 1)}`;
  }, [weekStart]);

  const selectedDayLabel = useMemo(() => {
    const pad = (n: number) => String(n).padStart(2, "0");
    const date = parseYmd(addDaysYmd(weekStart, dayIndex));
    const dateLabel = `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()}`;
    return {
      name: t(DAY_FULL_LABELS[dayIndex]!),
      dateLabel,
    };
  }, [weekStart, dayIndex, t]);

  const storeName = useMemo(
    () =>
      sessionUser?.stores.find((store) => store.id === storeId)?.name ?? "",
    [sessionUser?.stores, storeId],
  );

  function weekPrintLabels(): ScheduleWeekPrintLabels {
    return {
      title: t("schedule.saveWeekPrintTitle"),
      storeLabel: t("schedule.saveWeekStore"),
      weekLabel: t("schedule.saveWeekRange"),
      personColumn: t("schedule.saveWeekPerson"),
      fromColumn: t("schedule.saveWeekFrom"),
      toColumn: t("schedule.saveWeekTo"),
      durationColumn: t("schedule.saveWeekDuration"),
      noShifts: t("schedule.saveWeekNoShifts"),
      noSchedule: t("schedule.saveWeekNoSchedule"),
      dayNames: DAY_FULL_LABELS.map((key) => t(key)),
      hoursUnit: t("schedule.hoursShort"),
      minutesUnit: t("schedule.minutesShort"),
      printHint: t("schedule.saveWeekPrintHint"),
    };
  }

  function exportWeekAsPdf() {
    if (!data) return;
    setSaveFormatOpen(false);
    setFlashMessage(null);
    const opened = openScheduleWeekPrint({
      weekStart,
      storeName,
      staff: data.staff,
      shifts: data.shifts,
      days: data.days,
      labels: weekPrintLabels(),
    });
    if (!opened) {
      setError(t("schedule.saveWeekPopupBlocked"));
      return;
    }
    setError(null);
    setFlashMessage(t("schedule.saveWeekSaved"));
  }

  async function exportWeekAsPicture() {
    // Use in-memory week data (same as PDF). Awaiting a refetch here breaks the
    // mobile user-gesture chain, so navigator.share / downloads fail silently.
    if (!storeId || !data || savingExport) return;
    setSavingExport(true);
    setError(null);
    setFlashMessage(null);
    try {
      const result = await downloadScheduleWeekPng({
        weekStart,
        storeName,
        staff: data.staff,
        shifts: data.shifts,
        days: data.days,
        labels: weekPrintLabels(),
      });
      setSaveFormatOpen(false);
      if (result === "failed") {
        setError(t("schedule.saveWeekPictureFailed"));
        return;
      }
      if (result === "ok") {
        setFlashMessage(t("schedule.saveWeekSaved"));
      }
    } catch {
      setSaveFormatOpen(false);
      setError(t("schedule.saveWeekPictureFailed"));
    } finally {
      setSavingExport(false);
    }
  }

  if (!storeReady) {
    return <LoadingSpinnerBlock wrapperClassName="flex justify-center py-10" />;
  }

  if (!storeId) {
    return (
      <div className={`${appPageShell} ${appChromeInset} py-6`}>
        <MobilePageHeader title={t("schedule.title")} />
        <p className="mt-4 text-sm text-muted">{t("app.noStores")}</p>
      </div>
    );
  }

  return (
    <div className={`${appPageShell} flex min-h-0 flex-col pb-4`}>
      <div className={appChromeInset}>
        <MobilePageHeader title={t("schedule.title")} />
      </div>

      <div className={`${appListInset} mt-3 space-y-3`}>
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">
              {selectedDayLabel.name}
            </p>
            <p className="text-xs tabular-nums text-muted">
              {selectedDayLabel.dateLabel}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              className="inline-flex size-8 items-center justify-center rounded-full border border-primary/45 text-primary disabled:opacity-50"
              aria-label="Previous week"
              onClick={() => setWeekStart(addDaysYmd(weekStart, -7))}
            >
              <ChevronRightIcon className="size-4 rotate-180" />
            </button>
            <p className="px-1 text-sm font-semibold tabular-nums text-foreground">
              {weekLabel}
            </p>
            <button
              type="button"
              className="inline-flex size-8 items-center justify-center rounded-full border border-primary/45 text-primary disabled:opacity-50"
              aria-label="Next week"
              onClick={() => setWeekStart(addDaysYmd(weekStart, 7))}
            >
              <ChevronRightIcon className="size-4" />
            </button>
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              className="inline-flex size-8 items-center justify-center rounded-full border border-primary/45 text-primary disabled:opacity-50"
              aria-label={t("schedule.saveWeek")}
              title={t("schedule.saveWeek")}
              disabled={!data || loading || savingExport}
              onClick={() => setSaveFormatOpen(true)}
            >
              <SaveDiskIcon className="size-4" />
            </button>
          </div>
        </div>

        {saveFormatOpen ? (
          <div
            className="fixed inset-x-0 z-[70] flex items-center justify-center bg-black/60 px-5"
            style={{ top: offsetTop, bottom: keyboardInset }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="schedule-save-format-title"
            onClick={() => {
              if (!savingExport) setSaveFormatOpen(false);
            }}
          >
            <div
              className="w-full max-w-[22rem] rounded-2xl border border-card-border bg-background px-5 pb-5 pt-6 shadow-[0_20px_50px_rgba(0,0,0,0.5)]"
              onClick={(event) => event.stopPropagation()}
            >
              <h2
                id="schedule-save-format-title"
                className="text-center text-[1.35rem] font-semibold leading-tight text-foreground"
              >
                {t("schedule.saveWeekFormatTitle")}
              </h2>
              <div className="mt-6 flex flex-col gap-2">
                <button
                  type="button"
                  disabled={savingExport}
                  className={appButtonPrimaryFull}
                  onClick={() => exportWeekAsPdf()}
                >
                  {t("schedule.saveWeekAsPdf")}
                </button>
                <button
                  type="button"
                  disabled={savingExport}
                  className={appButtonNeutralFull}
                  onClick={() => void exportWeekAsPicture()}
                >
                  {t("schedule.saveWeekAsPicture")}
                </button>
                <CancelButton
                  disabled={savingExport}
                  onClick={() => setSaveFormatOpen(false)}
                >
                  {t("common.cancel")}
                </CancelButton>
              </div>
            </div>
          </div>
        ) : null}

        <div className="grid grid-cols-7 gap-1">
          {DAY_LABELS.map((key, idx) => {
            const active = idx === dayIndex;
            const day = data?.days.find((d) => d.dayIndex === idx);
            const dayDone = day?.status === "FINALIZED";
            return (
              <button
                key={key}
                type="button"
                onClick={() => setDayIndex(idx)}
                className={`flex min-w-0 flex-col items-center justify-start gap-0.5 rounded-lg border px-0.5 py-1 text-[0.65rem] font-semibold leading-tight ${
                  active
                    ? "border-primary bg-selected text-primary"
                    : "border-card-border text-muted"
                }`}
              >
                <span className="min-w-0 truncate">{t(key)}</span>
                <span
                  className="inline-flex h-2.5 w-full shrink-0 items-center justify-center text-[9px] leading-none text-primary"
                  aria-hidden={!dayDone}
                >
                  {dayDone ? "✓" : null}
                </span>
              </button>
            );
          })}
        </div>

        {isOwner ? (
          <div
            role="group"
            aria-label={t("schedule.title")}
            className="grid grid-cols-2 gap-0.5 rounded-xl border border-card-border p-0.5"
          >
            <button
              type="button"
              disabled={saving || !isFinalized}
              className={`rounded-lg px-2 py-2 text-center text-[0.7rem] font-semibold ${
                !isFinalized
                  ? "bg-selected text-primary"
                  : "bg-transparent text-muted"
              }`}
              onClick={() => {
                if (isFinalized) void ownerAction("reopen");
              }}
            >
              {isFinalized
                ? t("schedule.edit")
                : t("schedule.modeManual")}
            </button>
            <button
              type="button"
              disabled={saving || isFinalized}
              className={`rounded-lg px-2 py-2 text-center text-[0.7rem] font-semibold ${
                isFinalized
                  ? "bg-selected text-primary"
                  : "bg-transparent text-muted"
              }`}
              onClick={() => void ownerAction("finalize")}
            >
              {isFinalized
                ? t("schedule.finalized")
                : t("schedule.finalize")}
            </button>
          </div>
        ) : null}

        {error ? (
          <p className="rounded-xl border border-danger-border bg-danger/10 px-3 py-2 text-sm text-error">
            {error}
          </p>
        ) : null}

        <ActionFlash
          message={flashMessage}
          durationMs={2000}
          onClear={clearFlash}
        />

        {loading || !data ? (
          <LoadingSpinnerBlock wrapperClassName="flex justify-center py-8" />
        ) : (
          <>
            <div className="rounded-2xl border border-card-border p-3">
              <DayCoverageBar
                ranges={dayCoverageRanges}
                hoursUnit={t("schedule.hoursShort")}
                minutesUnit={t("schedule.minutesShort")}
                labelFull={t("schedule.coverageFull")}
                labelPartial={t("schedule.coveragePartial")}
                labelEmpty={t("schedule.coverageEmpty")}
              />
              {missingShiftCount > 0 ? (
                <p className="mb-2 text-[0.65rem] text-muted">
                  {t("schedule.coverageHintAuto")}
                </p>
              ) : null}
              {isOwner ? (
                <p className="mb-2 text-[0.65rem] text-muted">
                  <span className="mr-2 inline-block size-2 rounded-sm bg-primary/70 align-middle" />
                  {t("schedule.legendAssigned")}
                </p>
              ) : null}
              {memberRows.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted">
                  {t("schedule.noShifts")}
                </p>
              ) : (
                <ul className="space-y-3">
                  {memberRows.map(({ person, shift }) => {
                    const name =
                      person.displayName?.trim() || person.username;
                    const inSchedule = !excludedToday.has(person.id);
                    const assigned = shift
                      ? { startMin: shift.startMin, endMin: shift.endMin }
                      : null;
                    return (
                      <li
                        key={person.id}
                        className={inSchedule ? undefined : "opacity-45"}
                      >
                        <div className="mb-1 grid grid-cols-[1.25rem_1.75rem_minmax(0,1fr)_auto] items-center gap-x-2">
                          {isOwner ? (
                            <label className="flex size-5 items-center justify-center">
                              <input
                                type="checkbox"
                                className="size-3.5 accent-[var(--primary)]"
                                checked={inSchedule}
                                disabled={saving || readOnly}
                                aria-label={t("schedule.includePerson", {
                                  name,
                                })}
                                onChange={(event) =>
                                  void ownerAction("setParticipant", undefined, {
                                    userId: person.id,
                                    scheduleParticipant: event.target.checked,
                                  })
                                }
                              />
                            </label>
                          ) : (
                            <span className="size-5" aria-hidden />
                          )}
                          <span className="flex size-7 items-center justify-center rounded-full border border-primary/45 text-[10px] font-bold text-primary">
                            {initials(name)}
                          </span>
                          <span className="min-w-0 truncate text-sm font-semibold text-foreground">
                            {name}
                          </span>
                          <MemberHoursLabel
                            personId={person.id}
                            assigned={assigned}
                            liveByUser={liveHoursByUser}
                            hoursUnit={t("schedule.hoursShort")}
                            minutesUnit={t("schedule.minutesShort")}
                          />
                        </div>
                        {inSchedule ? (
                          <MemberShiftBar
                            assigned={assigned}
                            editable={ownerCanEditShifts}
                            disabled={saving}
                            onLiveChange={(startMin, endMin) =>
                              setLiveHoursByUser((prev) => ({
                                ...prev,
                                [person.id]: { startMin, endMin },
                              }))
                            }
                            onCommit={(startMin, endMin) =>
                              void saveMemberShift(person.id, startMin, endMin)
                            }
                          />
                        ) : (
                          <p className="text-[0.65rem] text-muted">
                            {t("schedule.excludedFromSchedule")}
                          </p>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {readOnly ? (
              <p className="text-center text-xs text-muted">
                {t("schedule.viewOnly")}
              </p>
            ) : null}

            {isOwner ? (
              <div className="pt-1">
                <button
                  type="button"
                  className={appButtonPrimaryFull}
                  disabled={saving || readOnly}
                  onClick={() => void ownerAction("runAuto")}
                >
                  {t("schedule.runAuto")}
                </button>
                <p className="mt-1.5 text-center text-[0.65rem] text-muted">
                  {t("schedule.runAutoHint")}
                </p>
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

export default function SchedulePage() {
  return (
    <Suspense
      fallback={<LoadingSpinnerBlock wrapperClassName="flex justify-center py-10" />}
    >
      <SchedulePageInner />
    </Suspense>
  );
}

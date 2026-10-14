import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { requireClientOwner } from "@/lib/client-owner";
import { db } from "@/lib/db";
import { userCanAccessStore } from "@/lib/store-access";
import { apiT } from "@/i18n";
import {
  autoFillDay,
  clampScheduleMinutes,
  isValidWeekStart,
  mondayOfWeek,
  parseScheduleAccess,
  validateDayShifts,
  type ScheduleAccess,
  type ScheduleMode,
  type ShiftDraft,
} from "@/lib/schedule";
import { hoursThisMonthByUserIds } from "@/lib/schedule-month-hours";

const ownerBody = z.object({
  storeId: z.string().min(1),
  weekStart: z.string().min(1),
  dayIndex: z.number().int().min(0).max(6),
  action: z.enum([
    "setMode",
    "runAuto",
    "setShifts",
    "setParticipant",
    "finalize",
    "reopen",
  ]),
  mode: z.enum(["auto", "manual"]).optional(),
  userId: z.string().min(1).optional(),
  scheduleParticipant: z.boolean().optional(),
  shifts: z
    .array(
      z.object({
        userId: z.string().min(1),
        dayIndex: z.number().int().min(0).max(6),
        startMin: z.number().int(),
        endMin: z.number().int(),
      }),
    )
    .optional(),
});

type DayRow = {
  dayIndex: number;
  mode: string;
  status: string;
  finalizedAt: Date | null;
};

async function ensureWeek(storeId: string, weekStart: string) {
  const week = await db.storeScheduleWeek.upsert({
    where: { storeId_weekStart: { storeId, weekStart } },
    create: { storeId, weekStart, mode: "manual", status: "DRAFT" },
    update: {},
  });
  await ensureDays(week.id);
  return week;
}

async function ensureDays(weekId: string) {
  const existing = await db.storeScheduleDay.findMany({
    where: { weekId },
    select: { dayIndex: true },
  });
  const have = new Set(existing.map((d) => d.dayIndex));
  const missing = [0, 1, 2, 3, 4, 5, 6].filter((i) => !have.has(i));
  if (missing.length === 0) return;
  await db.storeScheduleDay.createMany({
    data: missing.map((dayIndex) => ({
      weekId,
      dayIndex,
      mode: "manual",
      status: "DRAFT",
    })),
  });
}

async function getDay(weekId: string, dayIndex: number) {
  await ensureDays(weekId);
  return db.storeScheduleDay.upsert({
    where: { weekId_dayIndex: { weekId, dayIndex } },
    create: { weekId, dayIndex, mode: "manual", status: "DRAFT" },
    update: {},
  });
}

/** Store-linked staff, or every active team user on the account (owners). */
async function loadStaff(
  storeId: string,
  scope: "store" | "client" = "store",
) {
  if (scope === "client") {
    const store = await db.store.findUnique({
      where: { id: storeId },
      select: { clientId: true },
    });
    if (!store) return [];
    return db.user.findMany({
      where: {
        clientId: store.clientId,
        active: true,
        role: "USER",
      },
      select: {
        id: true,
        username: true,
        displayName: true,
        clientRole: true,
      },
      orderBy: { username: "asc" },
    });
  }

  const links = await db.userStore.findMany({
    where: {
      storeId,
      user: { active: true, role: "USER" },
    },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          displayName: true,
          clientRole: true,
        },
      },
    },
    orderBy: { user: { username: "asc" } },
  });
  return links.map((link) => link.user);
}

function participantIdsForDay(
  staff: { id: string }[],
  excludedUserIds: string[],
): string[] {
  const excluded = new Set(excludedUserIds);
  return staff.filter((s) => !excluded.has(s.id)).map((s) => s.id);
}

async function resolveScheduleGate(storeId: string): Promise<{
  enabled: boolean;
  access: ScheduleAccess;
}> {
  const store = await db.store.findUnique({
    where: { id: storeId },
    select: {
      client: { select: { scheduleEnabled: true, scheduleAccess: true } },
    },
  });
  return {
    enabled: store?.client?.scheduleEnabled ?? true,
    access: parseScheduleAccess(store?.client?.scheduleAccess),
  };
}

/** Returns an error response when the account schedule mode blocks this user. */
function scheduleAccessDenied(
  request: Request,
  gate: { enabled: boolean; access: ScheduleAccess },
  isOwner: boolean,
): NextResponse | null {
  if (!gate.enabled || gate.access === "disabled") {
    return NextResponse.json(
      { error: apiT(request, "schedule.featureDisabled") },
      { status: 403 },
    );
  }
  if (gate.access === "private" && !isOwner) {
    return NextResponse.json(
      { error: apiT(request, "errors.forbidden") },
      { status: 403 },
    );
  }
  return null;
}

function serializeWeek(
  week: {
    id: string;
    storeId: string;
    weekStart: string;
    shifts: {
      id: string;
      userId: string;
      dayIndex: number;
      startMin: number;
      endMin: number;
    }[];
    days: DayRow[];
    dayExclusions: { userId: string; dayIndex: number }[];
  },
  staff: {
    id: string;
    username: string;
    displayName: string | null;
    clientRole: string | null;
  }[],
  isOwner: boolean,
  meId: string,
) {
  const byIndex = new Map(week.days.map((d) => [d.dayIndex, d]));
  const excludedByDay = new Map<number, string[]>();
  for (const row of week.dayExclusions) {
    const list = excludedByDay.get(row.dayIndex) ?? [];
    list.push(row.userId);
    excludedByDay.set(row.dayIndex, list);
  }
  const days = [0, 1, 2, 3, 4, 5, 6].map((dayIndex) => {
    const row = byIndex.get(dayIndex);
    return {
      dayIndex,
      mode: (row?.mode ?? "auto") as ScheduleMode,
      status: (row?.status ?? "DRAFT") as "DRAFT" | "FINALIZED",
      finalizedAt: row?.finalizedAt?.toISOString() ?? null,
      excludedUserIds: excludedByDay.get(dayIndex) ?? [],
    };
  });

  return {
    week: {
      id: week.id,
      storeId: week.storeId,
      weekStart: week.weekStart,
    },
    days,
    staff,
    shifts: week.shifts,
    me: { userId: meId, isOwner },
  };
}

async function loadFullWeek(weekId: string) {
  return db.storeScheduleWeek.findUniqueOrThrow({
    where: { id: weekId },
    include: {
      shifts: true,
      days: true,
      dayExclusions: { select: { userId: true, dayIndex: true } },
    },
  });
}

async function excludedUserIdsForDay(
  weekId: string,
  dayIndex: number,
): Promise<string[]> {
  const rows = await db.scheduleDayExclusion.findMany({
    where: { weekId, dayIndex },
    select: { userId: true },
  });
  return rows.map((r) => r.userId);
}

async function runAutoFillForDay(args: {
  clientId: string;
  weekId: string;
  dayIndex: number;
  staffUserIds: string[];
}) {
  const { clientId, weekId, dayIndex, staffUserIds } = args;
  const hoursThisMonthMin = await hoursThisMonthByUserIds(
    clientId,
    staffUserIds,
  );
  await replaceDayShifts(
    weekId,
    dayIndex,
    autoFillDay({
      dayIndex,
      staffUserIds,
      hoursThisMonthMin,
    }),
  );
}

export async function GET(request: Request) {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json(
      { error: apiT(request, "errors.unauthorized") },
      { status: 401 },
    );
  }

  const url = new URL(request.url);
  const storeId = url.searchParams.get("storeId")?.trim() ?? "";
  const weekStartRaw = url.searchParams.get("weekStart")?.trim() ?? "";
  const weekStart = weekStartRaw || mondayOfWeek();

  if (!storeId || !isValidWeekStart(weekStart)) {
    return NextResponse.json(
      { error: apiT(request, "errors.invalidData") },
      { status: 400 },
    );
  }

  const store = await userCanAccessStore(session.userId, storeId);
  if (!store) {
    return NextResponse.json(
      { error: apiT(request, "errors.forbidden") },
      { status: 403 },
    );
  }

  const me = await db.user.findUnique({
    where: { id: session.userId },
    select: { clientRole: true },
  });
  const isOwner = me?.clientRole === "OWNER";
  const accessDenied = scheduleAccessDenied(
    request,
    await resolveScheduleGate(storeId),
    isOwner,
  );
  if (accessDenied) return accessDenied;

  const week = await ensureWeek(storeId, weekStart);
  const full = await loadFullWeek(week.id);
  const staff = await loadStaff(storeId, isOwner ? "client" : "store");

  return NextResponse.json(serializeWeek(full, staff, isOwner, session.userId));
}

/** Owner: per-day mode, auto-run, manual shifts, finalize / reopen. */
export async function PATCH(request: Request) {
  let session;
  try {
    session = await requireClientOwner();
  } catch {
    return NextResponse.json(
      { error: apiT(request, "errors.forbidden") },
      { status: 403 },
    );
  }

  const parsed = ownerBody.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: apiT(request, "errors.invalidData") },
      { status: 400 },
    );
  }

  const { storeId, weekStart, dayIndex, action } = parsed.data;
  if (!isValidWeekStart(weekStart)) {
    return NextResponse.json(
      { error: apiT(request, "errors.invalidData") },
      { status: 400 },
    );
  }

  const store = await db.store.findFirst({
    where: { id: storeId, clientId: session.clientId, active: true },
  });
  if (!store) {
    return NextResponse.json(
      { error: apiT(request, "errors.forbidden") },
      { status: 403 },
    );
  }

  const accessDenied = scheduleAccessDenied(
    request,
    await resolveScheduleGate(storeId),
    true,
  );
  if (accessDenied) return accessDenied;

  const week = await ensureWeek(storeId, weekStart);
  const day = await getDay(week.id, dayIndex);

  if (
    day.status === "FINALIZED" &&
    action !== "reopen" &&
    action !== "finalize"
  ) {
    return NextResponse.json(
      { error: apiT(request, "schedule.locked") },
      { status: 409 },
    );
  }

  if (action === "reopen") {
    await db.storeScheduleDay.update({
      where: { id: day.id },
      data: { status: "DRAFT", finalizedAt: null, mode: "manual" },
    });
  } else if (action === "setMode") {
    const mode = parsed.data.mode ?? "auto";
    await db.storeScheduleDay.update({
      where: { id: day.id },
      data: { mode },
    });
    if (mode === "auto") {
      const staffForAuto = await loadStaff(storeId, "client");
      const excluded = await excludedUserIdsForDay(week.id, dayIndex);
      await runAutoFillForDay({
        clientId: store.clientId,
        weekId: week.id,
        dayIndex,
        staffUserIds: participantIdsForDay(staffForAuto, excluded),
      });
    }
  } else if (action === "runAuto") {
    // Equal split across included staff, then stay manual so the owner can tweak.
    const staffForAuto = await loadStaff(storeId, "client");
    const excluded = await excludedUserIdsForDay(week.id, dayIndex);
    await runAutoFillForDay({
      clientId: store.clientId,
      weekId: week.id,
      dayIndex,
      staffUserIds: participantIdsForDay(staffForAuto, excluded),
    });
    await db.storeScheduleDay.update({
      where: { id: day.id },
      data: { mode: "manual" },
    });
  } else if (action === "setParticipant") {
    const targetUserId = parsed.data.userId;
    const included = parsed.data.scheduleParticipant;
    if (!targetUserId || included === undefined) {
      return NextResponse.json(
        { error: apiT(request, "errors.invalidData") },
        { status: 400 },
      );
    }
    const target = await db.user.findFirst({
      where: {
        id: targetUserId,
        clientId: store.clientId,
        role: "USER",
        active: true,
      },
      select: { id: true },
    });
    if (!target) {
      return NextResponse.json(
        { error: apiT(request, "errors.forbidden") },
        { status: 403 },
      );
    }
    if (included) {
      await db.scheduleDayExclusion.deleteMany({
        where: {
          weekId: week.id,
          userId: target.id,
          dayIndex,
        },
      });
    } else {
      await db.scheduleDayExclusion.upsert({
        where: {
          weekId_userId_dayIndex: {
            weekId: week.id,
            userId: target.id,
            dayIndex,
          },
        },
        create: {
          weekId: week.id,
          userId: target.id,
          dayIndex,
        },
        update: {},
      });
      await db.scheduleShift.deleteMany({
        where: { weekId: week.id, userId: target.id, dayIndex },
      });
    }
  } else if (action === "setShifts") {
    const shifts = (parsed.data.shifts ?? [])
      .filter((s) => s.dayIndex === dayIndex)
      .map((s) => ({
        ...s,
        dayIndex,
        startMin: clampScheduleMinutes(s.startMin),
        endMin: clampScheduleMinutes(s.endMin),
      }));
    const check = validateDayShifts(shifts, { allowOverlap: true });
    if (!check.ok) {
      return NextResponse.json(
        { error: apiT(request, "schedule.invalidBounds") },
        { status: 400 },
      );
    }
    await db.storeScheduleDay.update({
      where: { id: day.id },
      data: { mode: "manual" },
    });
    await replaceDayShifts(week.id, dayIndex, shifts);
  } else if (action === "finalize") {
    await db.storeScheduleDay.update({
      where: { id: day.id },
      data: {
        status: "FINALIZED",
        finalizedAt: new Date(),
      },
    });
  }

  const full = await loadFullWeek(week.id);
  const staff = await loadStaff(storeId, "client");

  return NextResponse.json(
    serializeWeek(full, staff, true, session.userId),
  );
}

async function replaceDayShifts(
  weekId: string,
  dayIndex: number,
  drafts: ShiftDraft[],
) {
  await db.$transaction(async (tx) => {
    await tx.scheduleShift.deleteMany({ where: { weekId, dayIndex } });
    if (drafts.length === 0) return;
    await tx.scheduleShift.createMany({
      data: drafts.map((d) => ({
        weekId,
        userId: d.userId,
        dayIndex,
        startMin: d.startMin,
        endMin: d.endMin,
      })),
    });
  });
}

import { db } from "@/lib/db";

/** Calendar days for OCR admin charts — not the VPS clock (often UTC). */
export const DOCUMENT_OCR_USAGE_TIMEZONE =
  process.env.DOCUMENT_OCR_USAGE_TIMEZONE?.trim() || "Europe/Sofia";

export async function recordDocumentOcrScan(input: {
  userId: string;
  username: string;
  storeId: string;
}): Promise<void> {
  try {
    await db.documentOcrScan.create({
      data: {
        userId: input.userId,
        username: input.username,
        storeId: input.storeId,
      },
    });
  } catch (error) {
    console.error("document OCR scan log failed", error);
  }
}

export function documentOcrUsageDayKey(
  date: Date,
  timeZone: string = DOCUMENT_OCR_USAGE_TIMEZONE,
): string {
  try {
    return date.toLocaleDateString("en-CA", { timeZone });
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

function zonedOffsetMs(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);
  let hour = get("hour");
  if (hour === 24) hour = 0;
  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    hour,
    get("minute"),
    get("second"),
  );
  return asUtc - date.getTime();
}

/** Wall clock in `timeZone` → UTC instant (DST-safe, two-pass). */
export function zonedLocalToUtc(
  ymd: string,
  hour: number,
  minute: number,
  second: number,
  ms: number,
  timeZone: string = DOCUMENT_OCR_USAGE_TIMEZONE,
): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  // Offset from whole seconds only — Intl formatToParts has no fractional second.
  const wallAsUtc = Date.UTC(y, m - 1, d, hour, minute, second, 0);
  const offset1 = zonedOffsetMs(new Date(wallAsUtc), timeZone);
  let utc = wallAsUtc - offset1;
  const offset2 = zonedOffsetMs(new Date(utc), timeZone);
  utc = wallAsUtc - offset2;
  return new Date(utc + ms);
}

function startOfNextUsageDay(ymd: string): Date {
  const noon = zonedLocalToUtc(ymd, 12, 0, 0, 0);
  noon.setUTCDate(noon.getUTCDate() + 1);
  return zonedLocalToUtc(documentOcrUsageDayKey(noon), 0, 0, 0, 0);
}

function parseDayBound(
  value: string | null | undefined,
  endOfDay: boolean,
): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  if (endOfDay) {
    return new Date(startOfNextUsageDay(value).getTime() - 1);
  }
  return zonedLocalToUtc(value, 0, 0, 0, 0);
}

function startOfUsageDay(daysAgo: number): Date {
  const todayYmd = documentOcrUsageDayKey(new Date());
  const noon = zonedLocalToUtc(todayYmd, 12, 0, 0, 0);
  noon.setUTCDate(noon.getUTCDate() - daysAgo);
  return zonedLocalToUtc(documentOcrUsageDayKey(noon), 0, 0, 0, 0);
}

function eachDayInclusive(from: Date, to: Date): string[] {
  const days: string[] = [];
  let ymd = documentOcrUsageDayKey(from);
  const endYmd = documentOcrUsageDayKey(to);
  // Guard runaway if TZ math fails.
  for (let i = 0; i < 400 && ymd <= endYmd; i += 1) {
    days.push(ymd);
    const noon = zonedLocalToUtc(ymd, 12, 0, 0, 0);
    noon.setUTCDate(noon.getUTCDate() + 1);
    ymd = documentOcrUsageDayKey(noon);
  }
  return days;
}

export type DocumentOcrUsageRow = {
  userId: string;
  username: string;
  clientId: string | null;
  clientName: string | null;
  homeUser: boolean;
  scanCount: number;
  lastScanAt: string;
};

export type DocumentOcrDailyRow = {
  day: string;
  count: number;
};

export type DocumentOcrPeriodSummaries = {
  days7: number;
  days14: number;
  days30: number;
};

export async function queryDocumentOcrUsage(input: {
  dateFrom?: string;
  dateTo?: string;
  q?: string;
}): Promise<{
  rows: DocumentOcrUsageRow[];
  daily: DocumentOcrDailyRow[];
  totalScans: number;
  summaries: DocumentOcrPeriodSummaries;
}> {
  const from = parseDayBound(input.dateFrom, false) ?? startOfUsageDay(6);
  const to = parseDayBound(input.dateTo, true) ?? new Date();
  if (to.getTime() < from.getTime()) {
    return {
      rows: [],
      daily: [],
      totalScans: 0,
      summaries: await loadPeriodSummaries(),
    };
  }

  const where = {
    createdAt: {
      gte: from,
      lte: to,
    },
  };

  const [scans, summaries] = await Promise.all([
    db.documentOcrScan.findMany({
      where,
      select: { userId: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
    loadPeriodSummaries(),
  ]);

  if (scans.length === 0) {
    return {
      rows: [],
      daily: eachDayInclusive(from, to).map((day) => ({ day, count: 0 })),
      totalScans: 0,
      summaries,
    };
  }

  const userIds = [...new Set(scans.map((scan) => scan.userId))];
  const users = await db.user.findMany({
    where: { id: { in: userIds } },
    select: {
      id: true,
      username: true,
      clientId: true,
      client: { select: { name: true, homeUser: true } },
    },
  });
  const userById = new Map(users.map((user) => [user.id, user]));

  const needle = input.q?.trim().toLowerCase() ?? "";
  const allowedUserIds = new Set<string>();
  for (const userId of userIds) {
    const user = userById.get(userId);
    const username = user?.username ?? userId;
    const clientName = user?.client?.name ?? null;
    if (
      !needle ||
      username.toLowerCase().includes(needle) ||
      (clientName?.toLowerCase().includes(needle) ?? false)
    ) {
      allowedUserIds.add(userId);
    }
  }

  const perUser = new Map<
    string,
    { count: number; lastScanAt: Date }
  >();
  const perDay = new Map<string, number>();
  for (const day of eachDayInclusive(from, to)) {
    perDay.set(day, 0);
  }

  let totalScans = 0;
  for (const scan of scans) {
    if (!allowedUserIds.has(scan.userId)) continue;
    totalScans += 1;
    const day = documentOcrUsageDayKey(scan.createdAt);
    perDay.set(day, (perDay.get(day) ?? 0) + 1);
    const prev = perUser.get(scan.userId);
    if (!prev) {
      perUser.set(scan.userId, { count: 1, lastScanAt: scan.createdAt });
    } else {
      prev.count += 1;
      if (scan.createdAt > prev.lastScanAt) prev.lastScanAt = scan.createdAt;
    }
  }

  const rows: DocumentOcrUsageRow[] = [...perUser.entries()]
    .map(([userId, stats]) => {
      const user = userById.get(userId);
      return {
        userId,
        username: user?.username ?? userId,
        clientId: user?.clientId ?? null,
        clientName: user?.client?.name ?? null,
        homeUser: user?.client?.homeUser ?? false,
        scanCount: stats.count,
        lastScanAt: stats.lastScanAt.toISOString(),
      };
    })
    .sort((a, b) => b.scanCount - a.scanCount);

  const daily: DocumentOcrDailyRow[] = [...perDay.entries()].map(
    ([day, count]) => ({ day, count }),
  );

  return { rows, daily, totalScans, summaries };
}

async function loadPeriodSummaries(): Promise<DocumentOcrPeriodSummaries> {
  const now = new Date();
  const [days7, days14, days30] = await Promise.all([
    db.documentOcrScan.count({
      where: { createdAt: { gte: startOfUsageDay(6), lte: now } },
    }),
    db.documentOcrScan.count({
      where: { createdAt: { gte: startOfUsageDay(13), lte: now } },
    }),
    db.documentOcrScan.count({
      where: { createdAt: { gte: startOfUsageDay(29), lte: now } },
    }),
  ]);
  return { days7, days14, days30 };
}

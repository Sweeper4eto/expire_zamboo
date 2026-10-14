import { db } from "@/lib/db";
import {
  addDaysYmd,
  formatYmd,
  monthStartYmd,
  sumShiftMinutesInRange,
} from "@/lib/schedule";

/**
 * Minutes worked this month (1st → yesterday) across all stores on the client.
 * Lightweight: queries shifts directly instead of loading whole weeks.
 */
export async function hoursThisMonthByUserIds(
  clientId: string,
  userIds: string[],
): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  for (const id of userIds) out[id] = 0;
  if (userIds.length === 0) return out;

  const fromYmd = monthStartYmd();
  const toYmdExclusive = formatYmd(new Date());
  const stores = await db.store.findMany({
    where: { clientId },
    select: { id: true },
  });
  if (stores.length === 0) return out;

  const shifts = await db.scheduleShift.findMany({
    where: {
      userId: { in: userIds },
      week: {
        storeId: { in: stores.map((s) => s.id) },
        weekStart: {
          gte: addDaysYmd(fromYmd, -6),
          lte: toYmdExclusive,
        },
      },
    },
    select: {
      userId: true,
      dayIndex: true,
      startMin: true,
      endMin: true,
      week: { select: { weekStart: true } },
    },
  });

  const byUser = new Map<
    string,
    { weekStart: string; dayIndex: number; startMin: number; endMin: number }[]
  >();
  for (const shift of shifts) {
    const list = byUser.get(shift.userId) ?? [];
    list.push({
      weekStart: shift.week.weekStart,
      dayIndex: shift.dayIndex,
      startMin: shift.startMin,
      endMin: shift.endMin,
    });
    byUser.set(shift.userId, list);
  }
  for (const [userId, userShifts] of byUser) {
    out[userId] = sumShiftMinutesInRange(userShifts, fromYmd, toYmdExclusive);
  }
  return out;
}

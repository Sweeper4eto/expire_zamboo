import { NextResponse } from "next/server";
import { z } from "zod";
import { requireClientOwner } from "@/lib/client-owner";
import { db } from "@/lib/db";
import { apiT } from "@/i18n";
import {
  SCHEDULE_ACCESS_OPTIONS,
  parseScheduleAccess,
} from "@/lib/schedule";

export async function GET(request: Request) {
  let session;
  try {
    session = await requireClientOwner();
  } catch {
    return NextResponse.json(
      { error: apiT(request, "errors.forbidden") },
      { status: 403 },
    );
  }

  const client = await db.client.findUnique({
    where: { id: session.clientId },
    select: { scheduleEnabled: true, scheduleAccess: true },
  });
  const scheduleEnabled = client?.scheduleEnabled ?? true;

  return NextResponse.json({
    scheduleEnabled,
    scheduleAccess: scheduleEnabled
      ? parseScheduleAccess(client?.scheduleAccess)
      : "disabled",
  });
}

const bodySchema = z.object({
  scheduleAccess: z.enum(SCHEDULE_ACCESS_OPTIONS),
});

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

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: apiT(request, "errors.invalidData") },
      { status: 400 },
    );
  }

  const current = await db.client.findUnique({
    where: { id: session.clientId },
    select: { scheduleEnabled: true },
  });
  if (!current?.scheduleEnabled) {
    return NextResponse.json(
      { error: apiT(request, "schedule.featureDisabled") },
      { status: 403 },
    );
  }

  const updated = await db.client.update({
    where: { id: session.clientId },
    data: { scheduleAccess: parsed.data.scheduleAccess },
    select: { scheduleEnabled: true, scheduleAccess: true },
  });

  return NextResponse.json({
    scheduleEnabled: updated.scheduleEnabled,
    scheduleAccess: parseScheduleAccess(updated.scheduleAccess),
  });
}

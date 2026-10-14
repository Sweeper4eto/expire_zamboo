import { NextResponse } from "next/server";
import { requireClientOwner } from "@/lib/client-owner";
import { db } from "@/lib/db";
import { apiT } from "@/i18n";
import { hoursThisMonthByUserIds } from "@/lib/schedule-month-hours";

/** Hours this month for one team member (edit sheet). */
export async function GET(request: Request) {
  let owner;
  try {
    owner = await requireClientOwner();
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "UNAUTHORIZED" || message === "PAYMENT_REQUIRED") {
      return NextResponse.json(
        { error: apiT(request, "errors.unauthorized") },
        { status: 401 },
      );
    }
    return NextResponse.json(
      { error: apiT(request, "errors.forbidden") },
      { status: 403 },
    );
  }

  const userId =
    new URL(request.url).searchParams.get("userId")?.trim() ?? "";
  if (!userId) {
    return NextResponse.json(
      { error: apiT(request, "errors.invalidData") },
      { status: 400 },
    );
  }

  const target = await db.user.findFirst({
    where: {
      id: userId,
      clientId: owner.clientId,
      role: "USER",
    },
    select: { id: true },
  });
  if (!target) {
    return NextResponse.json(
      { error: apiT(request, "errors.userNotFound") },
      { status: 404 },
    );
  }

  const hours = await hoursThisMonthByUserIds(owner.clientId, [target.id]);
  return NextResponse.json({
    userId: target.id,
    hoursThisMonthMin: hours[target.id] ?? 0,
  });
}

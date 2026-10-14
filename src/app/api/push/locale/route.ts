import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { apiT } from "@/i18n";

const localeSchema = z.object({
  locale: z.enum(["en", "bg"]),
});

/** Update push language for all of the current user's device subscriptions. */
export async function POST(request: Request) {
  let session;
  try {
    session = await requireSession({ allowMustChangePassword: true });
  } catch {
    return NextResponse.json(
      { error: apiT(request, "errors.unauthorized") },
      { status: 401 },
    );
  }

  const json = await request.json().catch(() => null);
  const parsed = localeSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: apiT(request, "errors.invalidData") },
      { status: 400 },
    );
  }

  const result = await db.pushSubscription.updateMany({
    where: { userId: session.userId },
    data: { locale: parsed.data.locale },
  });

  return NextResponse.json({ ok: true, updated: result.count });
}
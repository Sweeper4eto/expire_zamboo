import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { isPushConfigured } from "@/lib/push";
import { apiT, getLocaleFromRequest } from "@/i18n";

const subscribeSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
  locale: z.enum(["en", "bg"]).optional(),
});

export async function POST(request: Request) {
  if (!isPushConfigured()) {
    return NextResponse.json(
      { error: apiT(request, "errors.pushNotConfigured") },
      { status: 503 },
    );
  }

  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json(
      { error: apiT(request, "errors.unauthorized") },
      { status: 401 },
    );
  }

  const json = await request.json().catch(() => null);
  const parsed = subscribeSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: apiT(request, "errors.invalidData") },
      { status: 400 },
    );
  }

  const locale = parsed.data.locale ?? getLocaleFromRequest(request);

  await db.pushSubscription.upsert({
    where: { endpoint: parsed.data.endpoint },
    create: {
      userId: session.userId,
      endpoint: parsed.data.endpoint,
      p256dh: parsed.data.keys.p256dh,
      auth: parsed.data.keys.auth,
      locale,
    },
    update: {
      userId: session.userId,
      p256dh: parsed.data.keys.p256dh,
      auth: parsed.data.keys.auth,
      locale,
    },
  });

  return NextResponse.json({ ok: true });
}

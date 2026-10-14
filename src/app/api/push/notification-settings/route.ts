import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  clientDefaultsFromRow,
  expiryNotificationPrefsSchema,
  mergeClientDefaults,
  prefsFromUserRow,
  prefsToUserData,
} from "@/lib/expiry-notification-prefs";
import { userPrefsSelect } from "@/lib/push-expiry";
import { apiT } from "@/i18n";

async function sessionOrForbidden(request: Request) {
  try {
    return await requireSession();
  } catch {
    return NextResponse.json(
      { error: apiT(request, "errors.forbidden") },
      { status: 403 },
    );
  }
}

function serializePrefs(
  prefs: ReturnType<typeof mergeClientDefaults>,
  stores: Array<{ id: string; name: string }>,
) {
  return {
    ...prefs,
    stores,
  };
}

export async function GET(request: Request) {
  const session = await sessionOrForbidden(request);
  if (session instanceof NextResponse) return session;

  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: {
      ...userPrefsSelect,
      storeLinks: {
        where: { store: { active: true } },
        select: { store: { select: { id: true, name: true } } },
      },
    },
  });

  if (!user) {
    return NextResponse.json(
      { error: apiT(request, "errors.forbidden") },
      { status: 403 },
    );
  }

  const prefs = mergeClientDefaults(
    prefsFromUserRow(user),
    clientDefaultsFromRow(user.client ?? undefined),
  );
  const stores = user.storeLinks.map((link) => link.store);

  return NextResponse.json({
    settings: serializePrefs(prefs, stores),
  });
}

export async function PATCH(request: Request) {
  const session = await sessionOrForbidden(request);
  if (session instanceof NextResponse) return session;

  const json = await request.json().catch(() => null);
  const parsed = expiryNotificationPrefsSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: apiT(request, "errors.invalidData") },
      { status: 400 },
    );
  }

  const assigned = await db.userStore.findMany({
    where: { userId: session.userId, store: { active: true } },
    select: { storeId: true },
  });
  const allowed = new Set(assigned.map((row) => row.storeId));
  if (parsed.data.storeIds) {
    const invalid = parsed.data.storeIds.some((id) => !allowed.has(id));
    if (invalid) {
      return NextResponse.json(
        { error: apiT(request, "errors.invalidData") },
        { status: 400 },
      );
    }
  }

  const prefs = { ...parsed.data, customized: true };
  await db.user.update({
    where: { id: session.userId },
    data: prefsToUserData(prefs),
  });

  const stores = await db.store.findMany({
    where: { id: { in: [...allowed] }, active: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({
    settings: serializePrefs(prefs, stores),
  });
}

export const maxDuration = 120;

import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { purgeExpiredInventory } from "@/lib/inventory-purge";
import { sendExpiryDigests } from "@/lib/push-expiry";
import { syncZambooCatalogIfDue } from "@/lib/zamboo/sync";
import { apiT } from "@/i18n";

function secretsEqual(provided: string | null, expected: string | undefined): boolean {
  if (!provided || !expected) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  if (!secretsEqual(request.headers.get("x-cron-secret"), process.env.CRON_SECRET)) {
    return NextResponse.json(
      { error: apiT(request, "errors.forbidden") },
      { status: 403 },
    );
  }

  const purged = await purgeExpiredInventory();
  const push = await sendExpiryDigests();
  let zamboo: Awaited<ReturnType<typeof syncZambooCatalogIfDue>> | { error: string };
  try {
    zamboo = await syncZambooCatalogIfDue();
  } catch (error) {
    console.error("zamboo catalog sync failed", error);
    zamboo = {
      error: error instanceof Error ? error.message : "ZAMBOO_SYNC_FAILED",
    };
  }
  return NextResponse.json({ purged, push, zamboo });
}

export async function GET(request: Request) {
  return POST(request);
}
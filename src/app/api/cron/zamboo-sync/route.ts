import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { apiT } from "@/i18n";
import { syncZambooCatalogIfDue } from "@/lib/zamboo/sync";

export const maxDuration = 120;

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

  const force = new URL(request.url).searchParams.get("force") === "1";
  try {
    const result = await syncZambooCatalogIfDue({ force });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "ZAMBOO_SYNC_FAILED";
    console.error("zamboo catalog sync failed", error);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

export async function GET(request: Request) {
  return POST(request);
}

import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { sendExpiryDigests } from "@/lib/push-expiry";
import { apiT } from "@/i18n";

function secretsEqual(provided: string | null, expected: string | undefined): boolean {
  if (!provided || !expected) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** Hourly cron: send expiry push digests per user notification preferences. */
export async function POST(request: Request) {
  if (!secretsEqual(request.headers.get("x-cron-secret"), process.env.CRON_SECRET)) {
    return NextResponse.json(
      { error: apiT(request, "errors.forbidden") },
      { status: 403 },
    );
  }

  const push = await sendExpiryDigests();
  return NextResponse.json({ push });
}

export async function GET(request: Request) {
  return POST(request);
}

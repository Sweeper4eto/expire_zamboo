import { NextResponse } from "next/server";
import { getVapidPublicKey, isPushConfigured } from "@/lib/push";

export async function GET() {
  if (!isPushConfigured()) {
    return NextResponse.json({ configured: false, publicKey: null });
  }

  return NextResponse.json({
    configured: true,
    publicKey: getVapidPublicKey(),
  });
}

import { NextResponse } from "next/server";
import { logAuditEvent } from "@/lib/audit-log";
import { clearSessionCookie, getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { auditAuthLogin } from "@/lib/audit-details";

export async function POST(request: Request) {
  const session = await getSession();
  if (session) {
    const clientName =
      session.clientId
        ? (
            await db.client.findUnique({
              where: { id: session.clientId },
              select: { name: true },
            })
          )?.name
        : null;
    await logAuditEvent(
      request,
      session,
      "logout",
      auditAuthLogin(session.role, clientName),
    );
  }
  await clearSessionCookie();
  return NextResponse.json({ ok: true });
}

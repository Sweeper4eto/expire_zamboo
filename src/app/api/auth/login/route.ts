import { NextResponse } from "next/server";
import { z } from "zod";
import { auditAuthLogin } from "@/lib/audit-details";
import { getClientIp, logAuditEvent } from "@/lib/audit-log";
import { loginUser } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  clearLoginFailures,
  getLoginLockRemainingMs,
  recordLoginFailure,
} from "@/lib/login-rate-limit";
import { applySessionCookie } from "@/lib/session";
import { apiT } from "@/i18n";

const bodySchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    // Empty/missing credentials used to surface as the generic "invalid data"
    // message; treat them like a failed login instead.
    return NextResponse.json(
      { error: apiT(request, "auth.invalidCredentials") },
      { status: 401 },
    );
  }

  const ip = getClientIp(request);
  const remaining = getLoginLockRemainingMs(ip, parsed.data.username);
  if (remaining > 0) {
    return NextResponse.json(
      { error: apiT(request, "auth.tooManyAttempts") },
      {
        status: 429,
        headers: { "Retry-After": String(Math.ceil(remaining / 1000)) },
      },
    );
  }

  const result = await loginUser(parsed.data.username, parsed.data.password);
  if (!result.ok) {
    const lockedFor = recordLoginFailure(ip, parsed.data.username);
    if (lockedFor > 0) {
      return NextResponse.json(
        { error: apiT(request, "auth.tooManyAttempts") },
        {
          status: 429,
          headers: { "Retry-After": String(Math.ceil(lockedFor / 1000)) },
        },
      );
    }
    return NextResponse.json(
      { error: apiT(request, result.errorKey), code: result.code },
      { status: result.code === "NO_CLIENT" ? 403 : 401 },
    );
  }

  clearLoginFailures(ip, parsed.data.username);
  const clientName =
    result.user.clientId
      ? (
          await db.client.findUnique({
            where: { id: result.user.clientId },
            select: { name: true },
          })
        )?.name
      : null;
  await logAuditEvent(
    request,
    result.user,
    "login",
    auditAuthLogin(result.user.role, clientName),
  );
  const response = NextResponse.json({ user: result.user });
  applySessionCookie(response, result.token, request);
  return response;
}
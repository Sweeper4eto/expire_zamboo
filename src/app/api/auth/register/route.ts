import { NextResponse } from "next/server";
import { z } from "zod";
import { auditAuthRegister } from "@/lib/audit-details";
import { getClientIp, logAuditEvent } from "@/lib/audit-log";
import { registerUser } from "@/lib/auth";
import {
  clearLoginFailures,
  getLoginLockRemainingMs,
  recordLoginFailure,
} from "@/lib/login-rate-limit";
import { setSessionCookie } from "@/lib/session";
import { apiT } from "@/i18n";

const bodySchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
  email: z.string().optional(),
  accountType: z.enum(["home", "retail"]).default("home"),
  organizationName: z.string().optional(),
});

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: apiT(request, "errors.invalidData") },
      { status: 400 },
    );
  }

  const ip = getClientIp(request);
  const remaining = getLoginLockRemainingMs(ip, `register:${parsed.data.username}`);
  if (remaining > 0) {
    return NextResponse.json(
      { error: apiT(request, "auth.tooManyAttempts") },
      {
        status: 429,
        headers: { "Retry-After": String(Math.ceil(remaining / 1000)) },
      },
    );
  }

  const result = await registerUser(parsed.data.username, parsed.data.password, {
    accountType: parsed.data.accountType,
    organizationName: parsed.data.organizationName,
    email: parsed.data.email,
  });
  if (!result.ok) {
    recordLoginFailure(ip, `register:${parsed.data.username}`);
    return NextResponse.json(
      { error: apiT(request, result.errorKey) },
      { status: 400 },
    );
  }

  clearLoginFailures(ip, `register:${parsed.data.username}`);
  await setSessionCookie(result.token);

  await logAuditEvent(
    request,
    result.user,
    "register",
    auditAuthRegister(result.user.username),
  );

  return NextResponse.json({
    user: result.user,
    message: apiT(request, "auth.registerSuccess"),
  });
}

import { NextResponse } from "next/server";
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

function publicOrigin(request: Request): string {
  const host =
    request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const proto = (
    request.headers.get("x-forwarded-proto") ??
    new URL(request.url).protocol.replace(":", "")
  ).replace(/:$/, "");
  if (host) return `${proto}://${host}`;
  return new URL(request.url).origin;
}

function redirectTo(request: Request, path: string) {
  return NextResponse.redirect(new URL(path, publicOrigin(request)), 303);
}

/**
 * Form POST login → set cookies → 303 straight to /app?__session=…
 * (no intermediate "Signing in / Continue" page).
 */
export async function POST(request: Request) {
  try {
    const form = await request.formData().catch(() => null);
    const username = String(form?.get("username") ?? "").trim();
    const password = String(form?.get("password") ?? "");

    if (!username || !password) {
      console.warn("[login-form] empty fields", {
        hasUser: Boolean(username),
        passLen: password.length,
      });
      return redirectTo(request, "/login?error=credentials");
    }

    const ip = getClientIp(request);
    const remaining = getLoginLockRemainingMs(ip, username);
    if (remaining > 0) {
      return redirectTo(request, "/login?error=locked");
    }

    const result = await loginUser(username, password);
    if (!result.ok) {
      console.warn(
        "[login-form] rejected",
        username,
        result.errorKey,
        "passLen=",
        password.length,
      );
      const lockedFor = recordLoginFailure(ip, username);
      const code =
        lockedFor > 0
          ? "locked"
          : result.code === "NO_CLIENT"
            ? "no-client"
            : "credentials";
      return redirectTo(request, `/login?error=${code}`);
    }

    clearLoginFailures(ip, username);
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

    const nextPath = result.user.mustChangePassword
      ? "/change-password"
      : result.user.role === "ADMIN"
        ? "/admin"
        : "/app";

    const target = `${nextPath}?__session=${encodeURIComponent(result.token)}`;
    console.info("[login-form] ok", username, "→", nextPath);
    const response = redirectTo(request, target);
    applySessionCookie(response, result.token, request);
    return response;
  } catch (error) {
    console.error("[login-form]", error);
    return redirectTo(request, "/login?error=credentials");
  }
}

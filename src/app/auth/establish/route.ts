import { NextResponse } from "next/server";
import { resolveLoginTicket } from "@/lib/login-tickets";
import {
  applySessionCookie,
  COOKIE_NAME,
  CLIENT_COOKIE_NAME,
} from "@/lib/session";
import { verifySessionToken } from "@/lib/session-token";

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

function cookieFrom(request: Request, name: string): string {
  const raw = request.headers.get("cookie") ?? "";
  const parts = raw.split(/;\s*/);
  for (const part of parts) {
    const i = part.indexOf("=");
    if (i === -1) continue;
    if (part.slice(0, i) === name) {
      return decodeURIComponent(part.slice(i + 1));
    }
  }
  return "";
}

/** Silent redirect only — no HTML / Continue screen. */
function finishWithSession(
  request: Request,
  token: string,
  nextPath: string,
) {
  const target = `${nextPath}?__session=${encodeURIComponent(token)}`;
  const response = redirectTo(request, target);
  applySessionCookie(response, token, request);
  return response;
}

async function establish(request: Request) {
  const url = new URL(request.url);
  const ticketId = url.searchParams.get("k")?.trim() ?? "";
  const legacyToken = url.searchParams.get("t")?.trim() ?? "";
  const next = url.searchParams.get("next")?.trim() || "/app";
  const safeNext =
    next.startsWith("/") && !next.startsWith("//") ? next : "/app";

  const token = (ticketId ? resolveLoginTicket(ticketId) : null) ?? legacyToken;

  if (!token) {
    const existing =
      cookieFrom(request, COOKIE_NAME) ||
      cookieFrom(request, CLIENT_COOKIE_NAME);
    if (existing && (await verifySessionToken(existing))) {
      return finishWithSession(request, existing, safeNext);
    }
    return redirectTo(request, "/login?error=credentials");
  }

  const session = await verifySessionToken(token);
  if (!session) {
    return redirectTo(request, "/login?error=credentials");
  }

  return finishWithSession(request, token, safeNext);
}

export async function GET(request: Request) {
  try {
    return await establish(request);
  } catch (error) {
    console.error("[auth/establish]", error);
    return redirectTo(request, "/login?error=credentials");
  }
}

export async function POST(request: Request) {
  return GET(request);
}

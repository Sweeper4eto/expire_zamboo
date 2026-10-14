import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import {
  CLIENT_COOKIE_NAME,
  COOKIE_NAME,
  MAX_AGE_SECONDS,
  createSessionToken,
  verifySessionToken,
  type SessionPayload,
} from "@/lib/session-token";

export {
  CLIENT_COOKIE_NAME,
  COOKIE_NAME,
  createSessionToken,
  verifySessionToken,
  type SessionPayload,
};

let testSessionToken: string | undefined;

export function setTestSessionToken(token: string | undefined): void {
  testSessionToken = token;
}

export async function getSession(): Promise<SessionPayload | null> {
  if (process.env.TEST_MODE === "1" && testSessionToken) {
    return verifySessionToken(testSessionToken);
  }

  const cookieStore = await cookies();
  const token =
    cookieStore.get(COOKIE_NAME)?.value ??
    cookieStore.get(CLIENT_COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

function sessionCookieSecure(request?: Request): boolean {
  if (process.env.SESSION_COOKIE_SECURE === "true") return true;
  if (process.env.SESSION_COOKIE_SECURE === "false") return false;

  if (request) {
    const proto = (
      request.headers.get("x-forwarded-proto") ??
      new URL(request.url).protocol.replace(":", "")
    ).toLowerCase();
    if (proto === "https") return true;
    if (proto === "http") return false;
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL ?? "";
  return appUrl.startsWith("https://");
}

export function sessionCookieOptions(request?: Request) {
  const secure = sessionCookieSecure(request);
  return {
    httpOnly: true as const,
    sameSite: "lax" as const,
    secure,
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  };
}

function clientCookieOptions(request?: Request) {
  const secure = sessionCookieSecure(request);
  return {
    httpOnly: false as const,
    sameSite: "lax" as const,
    secure,
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  };
}

export async function setSessionCookie(
  token: string,
  request?: Request,
): Promise<void> {
  if (process.env.TEST_MODE === "1") {
    setTestSessionToken(token);
    return;
  }

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, sessionCookieOptions(request));
  cookieStore.set(CLIENT_COOKIE_NAME, token, clientCookieOptions(request));
}

/** Attach session cookies to a response (HttpOnly + JS-readable LAN fallback). */
export function applySessionCookie(
  response: NextResponse,
  token: string,
  request?: Request,
): void {
  if (process.env.TEST_MODE === "1") {
    setTestSessionToken(token);
    return;
  }
  response.cookies.set(COOKIE_NAME, token, sessionCookieOptions(request));
  response.cookies.set(CLIENT_COOKIE_NAME, token, clientCookieOptions(request));
}

export async function clearSessionCookie(request?: Request): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, "", {
    ...sessionCookieOptions(request),
    maxAge: 0,
  });
  cookieStore.set(CLIENT_COOKIE_NAME, "", {
    ...clientCookieOptions(request),
    maxAge: 0,
  });
}

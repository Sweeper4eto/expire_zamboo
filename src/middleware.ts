import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { sessionCookieOptions } from "@/lib/session";
import {
  verifySessionToken,
  COOKIE_NAME,
  CLIENT_COOKIE_NAME,
} from "@/lib/session-token";

const publicPaths = ["/", "/login", "/register", "/contact", "/terms", "/privacy"];
/** Public pages that logged-in users may still open (legal / reading). */
const publicReadablePaths = ["/terms", "/privacy"];
const passwordChangePath = "/change-password";
const SESSION_QUERY = "__session";

function publicOrigin(request: NextRequest): string {
  const host =
    request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const proto = (
    request.headers.get("x-forwarded-proto") ??
    request.nextUrl.protocol.replace(":", "")
  ).replace(/:$/, "");
  if (host) return `${proto}://${host}`;
  return request.nextUrl.origin;
}

function redirectPath(request: NextRequest, path: string) {
  return NextResponse.redirect(new URL(path, publicOrigin(request)));
}

function applySessionCookie(
  response: NextResponse,
  token: string,
  request: NextRequest,
) {
  const opts = sessionCookieOptions(request);
  response.cookies.set(COOKIE_NAME, token, opts);
  response.cookies.set(CLIENT_COOKIE_NAME, token, {
    ...opts,
    httpOnly: false,
  });
}

export async function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  if (
    pathname.startsWith("/api/") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/uploads") ||
    pathname.startsWith("/auth/")
  ) {
    return NextResponse.next();
  }

  // Phone/Safari often drops Set-Cookie on redirects. Bootstrap from ?__session=
  // on this document response (200), not on a 302 — cookies stick that way.
  // Router prefetches/RSC fetches of the same URL must not bootstrap: they would
  // hand the session back after a logout, since the token lingers in the URL.
  const isRscRequest = request.headers.get("rsc") !== null;
  const bootstrapToken = isRscRequest
    ? ""
    : (searchParams.get(SESSION_QUERY)?.trim() ?? "");
  if (bootstrapToken) {
    const bootSession = await verifySessionToken(bootstrapToken);
    if (bootSession) {
      const response = NextResponse.next();
      applySessionCookie(response, bootstrapToken, request);
      console.info("[middleware] session bootstrap ok →", pathname);
      return response;
    }
    console.warn("[middleware] session bootstrap failed");
    return redirectPath(request, "/login?error=credentials");
  }

  const token =
    request.cookies.get(COOKIE_NAME)?.value ??
    request.cookies.get(CLIENT_COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;

  if (pathname.startsWith("/app") && !session) {
    console.warn("[middleware] /app blocked — no session cookie");
  }

  if (session?.mustChangePassword) {
    if (pathname === passwordChangePath || pathname === "/login") {
      return NextResponse.next();
    }
    return redirectPath(request, passwordChangePath);
  }

  if (pathname === passwordChangePath) {
    if (!session) {
      return redirectPath(request, "/login");
    }
    return NextResponse.next();
  }

  if (pathname.startsWith("/admin")) {
    if (!session) {
      return redirectPath(request, "/login");
    }
    if (session.role !== "ADMIN") {
      return redirectPath(request, "/app");
    }
    return NextResponse.next();
  }

  if (pathname.startsWith("/app")) {
    if (!session) {
      return redirectPath(request, "/login");
    }
    if (session.role === "ADMIN") {
      return redirectPath(request, "/admin");
    }
    return NextResponse.next();
  }

  if (publicPaths.includes(pathname)) {
    if (publicReadablePaths.includes(pathname)) {
      return NextResponse.next();
    }
    if (session?.role === "ADMIN") {
      return redirectPath(request, "/admin");
    }
    if (session?.role === "USER" && session.clientId) {
      return redirectPath(request, "/app");
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!.*\\..*).*)"],
};

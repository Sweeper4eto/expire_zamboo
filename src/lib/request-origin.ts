import type { NextRequest } from "next/server";

type RequestLike = Pick<Request, "headers" | "url"> | NextRequest;

export function requestOrigin(request: RequestLike): string {
  const headers = request.headers;
  const host =
    headers.get("x-forwarded-host") ?? headers.get("host");
  const proto =
    headers.get("x-forwarded-proto") ??
    ("nextUrl" in request && request.nextUrl
      ? request.nextUrl.protocol.replace(":", "")
      : new URL(request.url).protocol.replace(":", ""));

  if (host) {
    return `${proto}://${host}`;
  }

  return new URL(request.url).origin;
}

export function publicUrl(request: RequestLike, pathname: string): URL {
  return new URL(pathname, requestOrigin(request));
}

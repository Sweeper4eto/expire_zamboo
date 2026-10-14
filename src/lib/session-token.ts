import { SignJWT } from "jose/jwt/sign";
import { jwtVerify } from "jose/jwt/verify";
import type { Role } from "@/generated/prisma/client";

export const COOKIE_NAME = "magazin_session";
/** Non-HttpOnly fallback for phones that drop Set-Cookie on HTTP LAN IPs. */
export const CLIENT_COOKIE_NAME = "magazin_session_client";
export const MAX_AGE_SECONDS = 60 * 60 * 24 * 14;

export type SessionPayload = {
  userId: string;
  username: string;
  role: Role;
  clientId: string | null;
  mustChangePassword?: boolean;
};

function getSecret(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("SESSION_SECRET must be set and at least 16 characters");
  }
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(
  payload: SessionPayload,
): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(getSecret());
}

export async function verifySessionToken(
  token: string,
): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (
      typeof payload.userId !== "string" ||
      typeof payload.username !== "string" ||
      (payload.role !== "ADMIN" && payload.role !== "USER")
    ) {
      return null;
    }
    return {
      userId: payload.userId,
      username: payload.username,
      role: payload.role,
      clientId: typeof payload.clientId === "string" ? payload.clientId : null,
      mustChangePassword: payload.mustChangePassword === true,
    };
  } catch {
    return null;
  }
}

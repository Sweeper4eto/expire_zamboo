/**
 * The session token is mirrored into a JS-readable cookie and sessionStorage so
 * phones that drop Set-Cookie on HTTP LAN addresses stay signed in. Logging out
 * therefore has to clear that mirror too, or the next page load restores it.
 */
let signedOut = false;

/** True once this document logged out: mirror writers must stand down. */
export function isSignedOut(): boolean {
  return signedOut;
}

export async function clearClientSession(): Promise<void> {
  signedOut = true;
  try {
    // Dynamic import keeps the token/jose module out of the initial bundle.
    const { CLIENT_COOKIE_NAME } = await import("@/lib/session-token");
    const { clearCachedHomeUser } = await import("@/lib/home-user-cache");
    document.cookie = `${CLIENT_COOKIE_NAME}=; Path=/; Max-Age=0; SameSite=Lax`;
    sessionStorage.removeItem(CLIENT_COOKIE_NAME);
    clearCachedHomeUser();
  } catch {
    /* ignore */
  }
}

export async function logoutSession(): Promise<void> {
  await fetch("/api/auth/logout", {
    method: "POST",
    credentials: "same-origin",
  });
  await clearClientSession();
}

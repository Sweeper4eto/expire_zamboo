const HOME_USER_CACHE_KEY = "magazin_home_user";

export function readCachedHomeUser(): boolean | null {
  if (typeof window === "undefined") return null;
  try {
    const value = sessionStorage.getItem(HOME_USER_CACHE_KEY);
    if (value === "1") return true;
    if (value === "0") return false;
  } catch {
    /* ignore */
  }
  return null;
}

export function writeCachedHomeUser(homeUser: boolean) {
  try {
    sessionStorage.setItem(HOME_USER_CACHE_KEY, homeUser ? "1" : "0");
  } catch {
    /* ignore */
  }
}

export function clearCachedHomeUser() {
  try {
    sessionStorage.removeItem(HOME_USER_CACHE_KEY);
  } catch {
    /* ignore */
  }
}

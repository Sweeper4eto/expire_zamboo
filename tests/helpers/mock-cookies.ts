import { setTestSessionToken } from "@/lib/session";

export function clearMockCookie(): void {
  setTestSessionToken(undefined);
}

export async function setMockSession(token: string): Promise<void> {
  setTestSessionToken(token);
}

import type { Prisma } from "@/generated/prisma/client";
import type { MessageKey } from "@/i18n";
import { db } from "@/lib/db";
import {
  normalizeUsername,
  validateUsername,
} from "@/lib/register-validation";

type DbClient = Prisma.TransactionClient | typeof db;

/**
 * Validate a username change. Returns null when unchanged / not provided.
 * Returns `{ username }` when a rename should be applied.
 */
export function parseUsernameChange(
  raw: string | undefined,
  currentUsername: string,
):
  | { ok: true; username: string | null }
  | { ok: false; errorKey: MessageKey } {
  if (raw === undefined) return { ok: true, username: null };
  const errorKey = validateUsername(raw);
  if (errorKey) return { ok: false, errorKey };
  const username = normalizeUsername(raw);
  if (username === currentUsername) return { ok: true, username: null };
  return { ok: true, username };
}

export async function usernameIsTaken(
  client: DbClient,
  username: string,
  exceptUserId: string,
): Promise<boolean> {
  const other = await client.user.findFirst({
    where: { username, NOT: { id: exceptUserId } },
    select: { id: true },
  });
  return Boolean(other);
}

/** Keep denormalized username copies in sync with User.username. */
export async function syncDenormalizedUsername(
  client: DbClient,
  userId: string,
  username: string,
): Promise<void> {
  await Promise.all([
    client.auditLog.updateMany({
      where: { userId },
      data: { username },
    }),
    client.documentOcrScan.updateMany({
      where: { userId },
      data: { username },
    }),
  ]);
}

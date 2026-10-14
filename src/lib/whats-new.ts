export type WhatsNewPublicItem = {
  id: string;
  title: string;
  href: string | null;
};

const SEEN_IDS_KEY = "expire365-whats-new-seen-ids";
/** Legacy full-set fingerprint (sorted ids joined with `|`). */
const LEGACY_SEEN_KEY = "expire365-whats-new-seen";
/** One-time flag: local seen ids were uploaded to the user account. */
const MIGRATED_KEY = "expire365-whats-new-seen-migrated";

/** Stable fingerprint of a set of ids (kept for tests / migration). */
export function whatsNewFingerprint(items: { id: string }[]): string {
  return items
    .map((item) => item.id)
    .sort()
    .join("|");
}

function readSeenIdSet(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    migrateLegacyFingerprint();
    const raw = window.localStorage.getItem(SEEN_IDS_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(
      parsed.filter((value): value is string => typeof value === "string" && value.length > 0),
    );
  } catch {
    return new Set();
  }
}

function writeSeenIdSet(seen: Set<string>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SEEN_IDS_KEY, JSON.stringify([...seen].sort()));
  } catch {
    // ignore quota / private mode
  }
}

/** One-time: legacy fingerprint was `id1|id2|…` — treat those ids as seen. */
function migrateLegacyFingerprint(): void {
  if (typeof window === "undefined") return;
  try {
    const legacy = window.localStorage.getItem(LEGACY_SEEN_KEY);
    if (!legacy) return;
    const ids = legacy.split("|").map((part) => part.trim()).filter(Boolean);
    if (ids.length > 0) {
      const seen = new Set<string>();
      const existing = window.localStorage.getItem(SEEN_IDS_KEY);
      if (existing) {
        try {
          const parsed = JSON.parse(existing) as unknown;
          if (Array.isArray(parsed)) {
            for (const value of parsed) {
              if (typeof value === "string" && value) seen.add(value);
            }
          }
        } catch {
          /* ignore */
        }
      }
      for (const id of ids) seen.add(id);
      window.localStorage.setItem(SEEN_IDS_KEY, JSON.stringify([...seen].sort()));
    }
    window.localStorage.removeItem(LEGACY_SEEN_KEY);
  } catch {
    /* ignore */
  }
}

export function getSeenWhatsNewIds(): Set<string> {
  return readSeenIdSet();
}

/**
 * Local ids still stored from the old per-device dismiss flow.
 * Used once to sync onto the logged-in user, then cleared via markLocalMigrated.
 */
export function getLocalWhatsNewSeenIdsPendingMigration(): string[] {
  if (typeof window === "undefined") return [];
  try {
    if (window.localStorage.getItem(MIGRATED_KEY) === "1") return [];
    return [...readSeenIdSet()];
  } catch {
    return [];
  }
}

export function markLocalWhatsNewSeenMigrated(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(MIGRATED_KEY, "1");
  } catch {
    /* ignore */
  }
}

/** Items the user has not acknowledged yet (client-side filter; prefer server filtering). */
export function unseenWhatsNewItems<T extends { id: string }>(
  items: T[],
  seenIds?: Iterable<string>,
): T[] {
  const seen = seenIds ? new Set(seenIds) : readSeenIdSet();
  return items.filter((item) => !seen.has(item.id));
}

export function markWhatsNewIdsSeen(ids: Iterable<string>): void {
  const seen = readSeenIdSet();
  for (const id of ids) {
    if (id) seen.add(id);
  }
  writeSeenIdSet(seen);
}

/** Mark the shown announcements as acknowledged locally (optimistic / offline cache). */
export function markWhatsNewSeen(items: { id: string }[]): void {
  markWhatsNewIdsSeen(items.map((item) => item.id));
}

export function shouldShowWhatsNew(
  items: { id: string }[],
  seenIds?: Iterable<string>,
): boolean {
  return unseenWhatsNewItems(items, seenIds).length > 0;
}

/** Persist acknowledgement for the current user on the server. */
export async function dismissWhatsNewOnServer(ids: string[]): Promise<boolean> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return true;
  try {
    const response = await fetch("/api/whats-new", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: unique }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/** @deprecated Prefer markWhatsNewSeen(items). Kept for older call sites. */
export function getWhatsNewSeenFingerprint(): string | null {
  if (typeof window === "undefined") return null;
  try {
    migrateLegacyFingerprint();
    const seen = readSeenIdSet();
    if (seen.size === 0) return null;
    return [...seen].sort().join("|");
  } catch {
    return null;
  }
}

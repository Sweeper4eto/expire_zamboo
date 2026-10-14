/** Sliding window: max document OCR parses per user (50 / 10 min). */

const WINDOW_MS = 10 * 60 * 1000;
const MAX_SCANS = 50;

const buckets = new Map<string, number[]>();

function prune(now: number): void {
  if (buckets.size < 500) return;
  for (const [key, stamps] of buckets) {
    const kept = stamps.filter((t) => now - t < WINDOW_MS);
    if (kept.length === 0) buckets.delete(key);
    else buckets.set(key, kept);
  }
}

function stampsInWindow(userId: string, now: number): number[] {
  const prev = buckets.get(userId) ?? [];
  return prev.filter((t) => now - t < WINDOW_MS);
}

/** Ms until the oldest scan in the window drops out, or 0 if under the limit. */
export function getDocumentOcrRetryAfterMs(userId: string): number {
  const now = Date.now();
  const stamps = stampsInWindow(userId, now);
  if (stamps.length < MAX_SCANS) return 0;
  const oldest = Math.min(...stamps);
  return Math.max(0, oldest + WINDOW_MS - now);
}

/**
 * Record a parse attempt if under the limit.
 * @returns null when allowed, or retry-after ms when blocked.
 */
export function takeDocumentOcrSlot(userId: string): number | null {
  const now = Date.now();
  prune(now);
  const stamps = stampsInWindow(userId, now);
  if (stamps.length >= MAX_SCANS) {
    const oldest = Math.min(...stamps);
    return Math.max(1, oldest + WINDOW_MS - now);
  }
  stamps.push(now);
  buckets.set(userId, stamps);
  return null;
}

export function resetDocumentOcrRateLimitsForTests(): void {
  buckets.clear();
}

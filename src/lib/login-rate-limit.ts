type Bucket = { fails: number; firstFailAt: number; lockedUntil: number };

const buckets = new Map<string, Bucket>();

const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILS = 8;
const LOCK_MS = 5 * 60 * 1000;

function keyFor(ip: string, username: string): string {
  return `${ip.trim() || "unknown"}:${username.trim().toLowerCase()}`;
}

function prune(now: number): void {
  if (buckets.size < 500) return;
  for (const [key, bucket] of buckets) {
    if (bucket.lockedUntil < now && now - bucket.firstFailAt > WINDOW_MS) {
      buckets.delete(key);
    }
  }
}

export function getLoginLockRemainingMs(ip: string, username: string): number {
  const now = Date.now();
  const bucket = buckets.get(keyFor(ip, username));
  if (!bucket) return 0;
  return Math.max(0, bucket.lockedUntil - now);
}

export function recordLoginFailure(ip: string, username: string): number {
  const now = Date.now();
  prune(now);
  const key = keyFor(ip, username);
  let bucket = buckets.get(key);
  if (!bucket || now - bucket.firstFailAt > WINDOW_MS) {
    bucket = { fails: 0, firstFailAt: now, lockedUntil: 0 };
  }
  bucket.fails += 1;
  if (bucket.fails >= MAX_FAILS) {
    bucket.lockedUntil = now + LOCK_MS;
  }
  buckets.set(key, bucket);
  return Math.max(0, bucket.lockedUntil - now);
}

export function clearLoginFailures(ip: string, username: string): void {
  buckets.delete(keyFor(ip, username));
}

export function resetLoginRateLimitsForTests(): void {
  buckets.clear();
}
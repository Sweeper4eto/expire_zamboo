import { db } from "@/lib/db";
import { isPushConfigured, sendPushToUser } from "@/lib/push";

/** At most one admin push wave per cooldown (avoids spam on repeated failed scans). */
const COOLDOWN_MS = 30 * 60 * 1000;

let lastAlertAt = 0;
let lastAlertKey = "";

function alertKey(message: string): string {
  // Group similar failures (same status + short detail), ignore user-specific noise.
  const status = /^OCR_PROVIDER:(\d{3}):/.exec(message)?.[1] ?? "other";
  const detail = message
    .replace(/^OCR_PROVIDER:\d{3}:/, "")
    .slice(0, 80)
    .toLowerCase();
  return `${status}:${detail}`;
}

export function shouldAlertDocumentAiFailure(message: string): boolean {
  if (
    message.startsWith("OCR_PROVIDER:") ||
    message === "OCR_CASCADE_EXHAUSTED" ||
    message === "OCR_NOT_CONFIGURED" ||
    message.startsWith("OCR_EMPTY:BLOCKED_")
  ) {
    return true;
  }
  return false;
}

function publicAlertBody(message: string): string {
  if (message === "OCR_NOT_CONFIGURED") {
    return "Document AI is not configured (missing API key).";
  }
  if (message === "OCR_CASCADE_EXHAUSTED") {
    return "Document scan AI: all models failed or cooling down — users asked to retry in ~5 minutes.";
  }
  if (message.startsWith("OCR_PROVIDER:")) {
    const rest = message.slice("OCR_PROVIDER:".length);
    const detail = /^\d{3}:/.test(rest) ? rest.slice(4).trim() : rest.trim();
    return detail
      ? `Document scan AI failed: ${detail.slice(0, 160)}`
      : "Document scan AI failed (provider error).";
  }
  if (message.startsWith("OCR_EMPTY:BLOCKED_")) {
    return `Document scan was blocked by the AI provider (${message.slice("OCR_EMPTY:".length)}).`;
  }
  return "Document scan AI failed.";
}

/**
 * Notify all ADMIN users via push when Gemini/OCR breaks.
 * Fire-and-forget safe; rate-limited to one alert per cooldown per error shape.
 */
export async function notifyAdminsDocumentAiFailure(
  message: string,
): Promise<void> {
  if (!shouldAlertDocumentAiFailure(message)) return;
  if (!isPushConfigured()) return;

  const key = alertKey(message);
  const now = Date.now();
  if (key === lastAlertKey && now - lastAlertAt < COOLDOWN_MS) {
    return;
  }
  lastAlertAt = now;
  lastAlertKey = key;

  const admins = await db.user.findMany({
    where: { role: "ADMIN", active: true },
    select: { id: true },
  });
  if (admins.length === 0) return;

  const payload = {
    title: "expire365 — Document AI",
    body: publicAlertBody(message),
    url: "/admin",
  };

  for (const admin of admins) {
    try {
      const result = await sendPushToUser(admin.id, payload);
      if (result.sent > 0) {
        console.warn(
          `document AI admin alert: pushed to ${admin.id} (sent=${result.sent})`,
        );
      }
    } catch (error) {
      console.error("document AI admin alert push failed", admin.id, error);
    }
  }
}

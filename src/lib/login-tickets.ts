import { randomBytes } from "crypto";

type Ticket = { token: string; expiresAt: number };

const globalStore = globalThis as unknown as {
  __expire365LoginTickets?: Map<string, Ticket>;
};

function tickets(): Map<string, Ticket> {
  if (!globalStore.__expire365LoginTickets) {
    globalStore.__expire365LoginTickets = new Map();
  }
  return globalStore.__expire365LoginTickets;
}

const TTL_MS = 120_000;

function prune() {
  const now = Date.now();
  for (const [id, ticket] of tickets()) {
    if (ticket.expiresAt <= now) tickets().delete(id);
  }
}

/** Short opaque code → session JWT. Avoids huge ?token= URLs on mobile Safari. */
export function createLoginTicket(sessionToken: string): string {
  prune();
  const id = randomBytes(16).toString("hex");
  tickets().set(id, { token: sessionToken, expiresAt: Date.now() + TTL_MS });
  return id;
}

/**
 * Resolve a ticket without consuming it immediately.
 * Phones often hit establish twice (meta refresh + JS) — one-time delete broke login.
 */
export function resolveLoginTicket(id: string): string | null {
  prune();
  const ticket = tickets().get(id);
  if (!ticket) return null;
  if (ticket.expiresAt <= Date.now()) {
    tickets().delete(id);
    return null;
  }
  return ticket.token;
}

export function clearLoginTicket(id: string): void {
  tickets().delete(id);
}

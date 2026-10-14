import "dotenv/config";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  prismaRev?: string;
};

/** Bump when the Prisma schema changes so the hot-reload cache does not keep a stale client. */
const PRISMA_CLIENT_REV = "zamboo-catalog-v1";

function createClient() {
  const configured = process.env.DATABASE_URL;
  if (!configured && process.env.NODE_ENV === "production") {
    // Never silently fall back to an empty ./dev.db in production — that yields
    // confusing "table does not exist" errors against a phantom database.
    throw new Error(
      "DATABASE_URL is not set. Refusing to start with a fallback SQLite file. " +
        "Set DATABASE_URL (e.g. file:/var/lib/magazin/data.db) in the environment/.env.",
    );
  }
  const url = configured ?? "file:./dev.db";
  const adapter = new PrismaBetterSqlite3({ url });
  return new PrismaClient({ adapter });
}

function getClient(): PrismaClient {
  if (
    globalForPrisma.prisma &&
    globalForPrisma.prismaRev === PRISMA_CLIENT_REV
  ) {
    return globalForPrisma.prisma;
  }
  const client = createClient();
  globalForPrisma.prisma = client;
  globalForPrisma.prismaRev = PRISMA_CLIENT_REV;
  return client;
}

export const db = getClient();

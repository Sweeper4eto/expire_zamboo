import { execSync } from "node:child_process";
import { rmSync } from "node:fs";
import { e2eDatabaseUrl } from "./helpers/env";

export default async function globalSetup() {
  const dbPath = e2eDatabaseUrl.replace("file:", "");
  rmSync(dbPath, { force: true });

  process.env.DATABASE_URL = e2eDatabaseUrl;
  process.env.SESSION_SECRET = "e2e-session-secret-32chars!!";
  process.env.CRON_SECRET = "e2e-cron-secret";

  execSync("npx prisma migrate deploy", {
    env: { ...process.env, DATABASE_URL: e2eDatabaseUrl },
    stdio: "inherit",
  });

  execSync("npx tsx prisma/seed.ts", {
    env: { ...process.env, DATABASE_URL: e2eDatabaseUrl },
    stdio: "inherit",
  });
}

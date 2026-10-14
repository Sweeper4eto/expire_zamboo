import { defineConfig, devices } from "@playwright/test";
import { e2eDatabaseUrl } from "./e2e/helpers/env";

const port = 3100;
/** Production server avoids Next.js Fast Refresh / corrupt-manifest flakes during long e2e runs. */
const useProdServer = process.env.E2E_DEV !== "1";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 1,
  workers: 1,
  timeout: 60_000,
  globalSetup: "./e2e/global-setup.ts",
  reporter: "list",
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: "on-first-retry",
  },
  webServer: {
    command: useProdServer
      ? `npx next build --webpack && npx next start --port ${port}`
      : `npx next dev --webpack --port ${port}`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: false,
    timeout: useProdServer ? 360_000 : 120_000,
    env: {
      DATABASE_URL: e2eDatabaseUrl,
      SESSION_SECRET: "e2e-session-secret-32chars!!",
      CRON_SECRET: "e2e-cron-secret",
      SEED_ADMIN_USERNAME: "admin",
      SEED_ADMIN_PASSWORD: "admin123",
      // Throwaway keypair so push endpoints are exercised, not short-circuited.
      VAPID_PUBLIC_KEY:
        "BKpMZKCQLLYdBM41gkgxFFA4NUB7haxCDcLkLzc5OOBOYe0qdVUuWc9dip10jxKFo19Z0ZJCnB5_oDVc74WN1ts",
      VAPID_PRIVATE_KEY: "aFeTtcqlyXtJSgqQq8iui7L1p6gshQATvzIUTv1K0SU",
      VAPID_SUBJECT: "mailto:e2e@expire365.test",
    },
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});

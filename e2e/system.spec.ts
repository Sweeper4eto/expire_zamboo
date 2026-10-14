import { test, expect } from "@playwright/test";
import {
  assertNoNextJsOverlay,
  loginViaForm,
  withAdminApi,
} from "./helpers/auth";
import {
  provisionBusinessOwner,
  provisionHomeOwner,
  skipPwaInstallPrompt,
} from "./helpers/provision";

test.describe("Cross-cutting public & admin", () => {
  test("terms and privacy load without overlay", async ({ page }) => {
    await page.goto("/terms");
    await expect(
      page.getByRole("heading", { name: /Terms of Service/i }),
    ).toBeVisible();
    await assertNoNextJsOverlay(page);

    await page.goto("/privacy");
    await expect(
      page.getByRole("heading", { name: /Privacy Policy/i }),
    ).toBeVisible();
    await assertNoNextJsOverlay(page);
  });

  test("guest contact page loads", async ({ page }) => {
    await page.goto("/contact");
    await expect(
      page.getByRole("heading", { name: "Contact Support" }),
    ).toBeVisible();
    await assertNoNextJsOverlay(page);
  });

  test("admin can open clients and users tabs", async ({ page }) => {
    await loginViaForm(page, "admin", "admin123");
    await expect(page).toHaveURL(/\/admin/);
    await expect(page.getByText("Admin panel")).toBeVisible();
    await page.getByRole("tab", { name: "Accounts", exact: true }).first().click();
    await page.getByRole("button", { name: "Users", exact: true }).click();
    await page.getByRole("tab", { name: "Payments", exact: true }).first().click();
    // Support tab name carries a "new requests" badge count (e.g. "Support 2").
    await page.getByRole("tab", { name: /^Support/ }).first().click();
    await assertNoNextJsOverlay(page);
  });

  test("admin API can list clients after business provision", async ({
    baseURL,
  }) => {
    const user = await provisionBusinessOwner(baseURL!, { withProduct: false });
    await withAdminApi(baseURL!, async (api) => {
      const response = await api.get("/api/admin/clients");
      expect(response.ok()).toBeTruthy();
      const body = (await response.json()) as {
        clients: { id: string }[];
      };
      expect(body.clients.some((c) => c.id === user.clientId)).toBeTruthy();
    });
  });

  test("the Logout button ends the session for good", async ({
    page,
    baseURL,
  }) => {
    const user = await provisionHomeOwner(baseURL!, { withProduct: false });
    await skipPwaInstallPrompt(page);
    await loginViaForm(page, user.username, user.password);
    await expect(page).toHaveURL(/\/app/);

    await page.getByRole("button", { name: "Logout" }).click();
    await expect(page).toHaveURL(/\/login/);

    // The session token is mirrored client-side, so it must not come back.
    await page.goto("/app");
    await expect(page).toHaveURL(/\/login/);
    await assertNoNextJsOverlay(page);
  });

  test("admin logout ends the admin session too", async ({ page }) => {
    await loginViaForm(page, "admin", "admin123");
    await expect(page).toHaveURL(/\/admin/);

    await page.getByRole("button", { name: "Logout" }).click();
    await expect(page).toHaveURL(/\/login/);

    await page.goto("/admin");
    await expect(page).toHaveURL(/\/login/);
  });

  test("home and business users stay on their product areas", async ({
    page,
    baseURL,
  }) => {
    const home = await provisionHomeOwner(baseURL!, { withProduct: false });
    await loginViaForm(page, home.username, home.password);
    await expect(page).toHaveURL(/\/app/);
    await page.goto("/admin");
    await expect(page).not.toHaveURL(/\/admin$/);

    await page.context().clearCookies();
    const biz = await provisionBusinessOwner(baseURL!, { withProduct: false });
    await loginViaForm(page, biz.username, biz.password);
    await expect(page).toHaveURL(/\/app/);
  });
});

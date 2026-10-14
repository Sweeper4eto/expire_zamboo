import { test, expect } from "@playwright/test";
import {
  assertNoNextJsOverlay,
  loginViaForm,
  registerUserViaApi,
  withAdminApi,
} from "./helpers/auth";

test.describe("Login form", () => {
  test("renders without a Next.js error overlay", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("button", { name: "Log in" })).toBeVisible();
    await assertNoNextJsOverlay(page);
  });

  test("admin can sign in via the form and reach the admin panel", async ({
    page,
  }) => {
    await loginViaForm(page, "admin", "admin123");
    await expect(page).toHaveURL(/\/admin/);
    await assertNoNextJsOverlay(page);
    await expect(page.getByText("Admin panel")).toBeVisible();
  });

  test("home user can sign in via the form and reach the app", async ({
    page,
    baseURL,
  }) => {
    const username = `fl${Date.now().toString(36).slice(-8)}`;
    await withAdminApi(baseURL!, async (api) => {
      await registerUserViaApi(api, username);
    });

    await loginViaForm(page, username, "password123");
    await expect(page).toHaveURL(/\/app/);
    await assertNoNextJsOverlay(page);
  });

  test("wrong password stays on login and shows an error", async ({ page }) => {
    await loginViaForm(page, "admin", "not-the-password");
    await expect(page).toHaveURL(/\/login/);
    await expect(
      page.getByText("Invalid username or password"),
    ).toBeVisible();
    await assertNoNextJsOverlay(page);
  });
});

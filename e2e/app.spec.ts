import { test, expect } from "@playwright/test";
import { loginInBrowser } from "./helpers/auth";

test.describe("Admin UI", () => {
  test("admin panel shows English labels", async ({ page }) => {
    await loginInBrowser(page, "admin", "admin123");
    await expect(page).toHaveURL(/\/admin/);
    await expect(page.getByText("Admin panel")).toBeVisible();
    await expect(page.getByRole("tab", { name: "Accounts", exact: true }).first()).toBeVisible();
    await expect(page.getByRole("tab", { name: "Household", exact: true }).first()).toBeVisible();
    await expect(page.getByRole("tab", { name: "Payments", exact: true }).first()).toBeVisible();
  });
});

test.describe("Public pages", () => {
  test("home page shows English copy", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Track expiry")).toBeVisible();
    await expect(page.getByText("before it costs you")).toBeVisible();
    await expect(page.getByRole("link", { name: "Log in" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Register" })).toBeVisible();
  });

  test("registration creates account and opens the app", async ({ page }) => {
    const username = `reg${Date.now().toString(36).slice(-8)}`;
    await page.goto("/register");
    await page.getByRole("radio", { name: "Household" }).click();
    await page.getByLabel("Username").fill(username);
    await page.getByLabel("Password", { exact: true }).fill("password123");
    await page.getByLabel("Confirm password").fill("password123");
    await page.getByRole("button", { name: "Register" }).click();
    await expect(page).toHaveURL(/\/app/);
  });
});

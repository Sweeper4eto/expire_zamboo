import { test, expect } from "@playwright/test";
import { assertNoNextJsOverlay } from "./helpers/auth";
import {
  loginWithStore,
  provisionBusinessOwner,
  provisionHomeOwner,
  useLocale,
} from "./helpers/provision";

test.describe("Bulgarian locale", () => {
  test("the switcher changes the login page language", async ({ page }) => {
    await page.goto("/login");
    await expect(
      page.getByRole("heading", { name: "Log in to your account" }),
    ).toBeVisible();

    await page.getByRole("button", { name: "EN" }).click();
    await page.getByRole("option", { name: "БГ" }).click();

    await expect(page.getByRole("button", { name: "Вход" })).toBeVisible();
    await expect(page.getByPlaceholder("Потребителско име")).toBeVisible();
    await assertNoNextJsOverlay(page);

    // The choice is a cookie, so a server-rendered reload keeps Bulgarian.
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Влез в акаунта си" }),
    ).toBeVisible();
  });

  test("login errors are translated server-side", async ({ page, baseURL }) => {
    await useLocale(page, "bg", baseURL!);
    await page.goto("/login");

    await page.getByPlaceholder("Потребителско име").fill("admin");
    await page.getByPlaceholder("Парола").fill("not-the-password");
    await page.getByRole("button", { name: "Вход" }).click();

    await expect(
      page.getByText("Грешно потребителско име или парола"),
    ).toBeVisible();
  });

  test("household app shell is translated", async ({ page, baseURL }) => {
    const user = await provisionHomeOwner(baseURL!, { withProduct: false });
    await useLocale(page, "bg", baseURL!);
    await loginWithStore(page, user);

    await page.goto("/app");
    await expect(page.getByText("Здравей,")).toBeVisible();
    await expect(page.getByRole("link", { name: /Екип/ })).toBeVisible();

    const nav = page.getByRole("navigation", { name: "Основна навигация" });
    await expect(nav.getByRole("link", { name: "Годност" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Добави" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Количка" })).toBeVisible();

    await page.goto(`/app/expiry?storeId=${user.storeId}`);
    await expect(page.getByRole("heading", { name: "Годност" })).toBeVisible();
    await assertNoNextJsOverlay(page);
  });

  test("retail app shell is translated", async ({ page, baseURL }) => {
    const user = await provisionBusinessOwner(baseURL!, { withProduct: false });
    await useLocale(page, "bg", baseURL!);
    await loginWithStore(page, user);

    await page.goto(`/app/expiry?storeId=${user.storeId}`);
    await expect(
      page.getByRole("heading", { name: "Списък с годност" }),
    ).toBeVisible();

    const nav = page.getByRole("navigation", { name: "Основна навигация" });
    await expect(nav.getByRole("link", { name: "Сканирай" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Количка" })).toHaveCount(0);
    await assertNoNextJsOverlay(page);
  });
});

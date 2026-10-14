import { test, expect } from "@playwright/test";
import {
  assertNoNextJsOverlay,
  loginViaForm,
  setUserPasswordViaApi,
  withAdminApi,
} from "./helpers/auth";
import { logoutViaPage, provisionHomeOwner } from "./helpers/provision";

const TEMP_PASSWORD = "temp-pass-123";
const CHOSEN_PASSWORD = "chosen-pass-456";

/** The submit button stays disabled until hydration, so wait for it. */
async function savePassword(
  page: import("@playwright/test").Page,
  password: string,
  confirmation: string,
) {
  await page.getByLabel("New password").fill(password);
  await page.getByLabel("Confirm password").fill(confirmation);
  const save = page.getByRole("button", { name: "Save new password" });
  await expect(save).toBeEnabled();
  await save.click();
}

test.describe("Forced password change", () => {
  test("admin-set password sends the user to change-password on next login", async ({
    page,
    baseURL,
  }) => {
    const user = await provisionHomeOwner(baseURL!, { withProduct: false });
    await withAdminApi(baseURL!, (api) =>
      setUserPasswordViaApi(api, user.userId, TEMP_PASSWORD),
    );

    await loginViaForm(page, user.username, TEMP_PASSWORD);
    await expect(page).toHaveURL(/\/change-password/);
    await expect(
      page.getByRole("heading", { name: "Choose a new password" }),
    ).toBeVisible();
    await assertNoNextJsOverlay(page);
  });

  test("app routes stay blocked until a new password is chosen", async ({
    page,
    baseURL,
  }) => {
    const user = await provisionHomeOwner(baseURL!, { withProduct: false });
    await withAdminApi(baseURL!, (api) =>
      setUserPasswordViaApi(api, user.userId, TEMP_PASSWORD),
    );

    await loginViaForm(page, user.username, TEMP_PASSWORD);
    await expect(page).toHaveURL(/\/change-password/);

    await page.goto(`/app/expiry?storeId=${user.storeId}`);
    await expect(page).toHaveURL(/\/change-password/);
  });

  test("mismatched confirmation is rejected before submitting", async ({
    page,
    baseURL,
  }) => {
    const user = await provisionHomeOwner(baseURL!, { withProduct: false });
    await withAdminApi(baseURL!, (api) =>
      setUserPasswordViaApi(api, user.userId, TEMP_PASSWORD),
    );

    await loginViaForm(page, user.username, TEMP_PASSWORD);
    await expect(page).toHaveURL(/\/change-password/);

    await savePassword(page, CHOSEN_PASSWORD, "something-else");

    await expect(page.getByText("Passwords do not match")).toBeVisible();
    await expect(page).toHaveURL(/\/change-password/);
  });

  test("choosing a new password unlocks the app and replaces the old one", async ({
    page,
    baseURL,
  }) => {
    const user = await provisionHomeOwner(baseURL!, { withProduct: false });
    await withAdminApi(baseURL!, (api) =>
      setUserPasswordViaApi(api, user.userId, TEMP_PASSWORD),
    );

    await loginViaForm(page, user.username, TEMP_PASSWORD);
    await expect(page).toHaveURL(/\/change-password/);

    await savePassword(page, CHOSEN_PASSWORD, CHOSEN_PASSWORD);
    await expect(page).toHaveURL(/\/app/);
    await assertNoNextJsOverlay(page);

    await logoutViaPage(page);
    await loginViaForm(page, user.username, CHOSEN_PASSWORD);
    await expect(page).toHaveURL(/\/app/);

    await logoutViaPage(page);
    await loginViaForm(page, user.username, TEMP_PASSWORD);
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByText("Invalid username or password")).toBeVisible();
  });
});

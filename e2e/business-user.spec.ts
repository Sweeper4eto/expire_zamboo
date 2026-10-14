import { test, expect } from "@playwright/test";
import { assertNoNextJsOverlay } from "./helpers/auth";
import {
  expectBottomNav,
  loginWithStore,
  openExpiryShowingAll,
  provisionBusinessOwner,
  scanKnownProductToExpiry,
  uniqueUsername,
} from "./helpers/provision";

async function fillTeamCreateForm(
  page: import("@playwright/test").Page,
  staffUsername: string,
) {
  await page.getByRole("button", { name: "Add User", exact: true }).click();
  const sheet = page.getByRole("dialog");
  await expect(sheet.getByRole("heading", { name: "New user" })).toBeVisible();

  await sheet.getByPlaceholder("Enter username").fill(staffUsername);
  await sheet.getByPlaceholder("Enter password", { exact: true }).fill("password123");

  const createBtn = sheet.getByRole("button", { name: "Create", exact: true });
  if (await createBtn.isDisabled()) {
    const storeCheckbox = sheet.locator('input[type="checkbox"]').nth(1);
    if (await storeCheckbox.count()) {
      await storeCheckbox.check();
    }
  }
  await expect(createBtn).toBeEnabled();
  await createBtn.click();
}

test.describe("Business user end-to-end", () => {
  test("retail shell: Document nav, Store Expiry title, no Cart", async ({
    page,
    baseURL,
  }) => {
    const user = await provisionBusinessOwner(baseURL!);
    await loginWithStore(page, user);

    await page.goto(`/app/expiry?storeId=${user.storeId}`);
    await expect(
      page.getByRole("heading", { name: "Store Expiry List" }),
    ).toBeVisible();
    await expectBottomNav(page, "business");
    await assertNoNextJsOverlay(page);
  });

  test("scan known product into store expiry list", async ({
    page,
    baseURL,
  }) => {
    const user = await provisionBusinessOwner(baseURL!);
    await loginWithStore(page, user);

    await scanKnownProductToExpiry(
      page,
      user.storeId,
      user.barcode,
      user.productName,
    );
    await expect(page.getByText(user.productName)).toBeVisible();
  });

  test("expiry detail exposes Reduce price for retail", async ({
    page,
    baseURL,
  }) => {
    const user = await provisionBusinessOwner(baseURL!);
    await loginWithStore(page, user);

    await scanKnownProductToExpiry(
      page,
      user.storeId,
      user.barcode,
      user.productName,
    );
    await openExpiryShowingAll(page, user.storeId);
    await expect(page.getByText(user.productName)).toBeVisible();
    await expect(page.getByRole("button", { name: "Reduce price" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Add to cart" })).toHaveCount(0);
    await assertNoNextJsOverlay(page);
  });

  test("cart route shows unavailable for business accounts", async ({
    page,
    baseURL,
  }) => {
    const user = await provisionBusinessOwner(baseURL!, { withProduct: false });
    await loginWithStore(page, user);
    await page.goto(`/app/orders?storeId=${user.storeId}`);
    await expect(
      page.getByText("The cart is not available for your account."),
    ).toBeVisible();
  });

  test("document scan page opens for retail (camera step, no crash)", async ({
    page,
    baseURL,
  }) => {
    const user = await provisionBusinessOwner(baseURL!, { withProduct: false });
    await loginWithStore(page, user);
    await page.goto(`/app/add-document?storeId=${user.storeId}`);
    await expect(page).toHaveURL(/\/app\/add-document/);
    await expect(
      page.getByRole("heading", { name: "Scan document" }),
    ).toBeVisible();
    await assertNoNextJsOverlay(page);
  });

  test("team owner can create a staff user", async ({ page, baseURL }) => {
    const user = await provisionBusinessOwner(baseURL!, { withProduct: false });
    await loginWithStore(page, user);
    const staff = uniqueUsername("bs");

    await page.goto("/app/team");
    await expect(page.getByRole("heading", { name: "Team" })).toBeVisible();
    await fillTeamCreateForm(page, staff);
    await expect(page.getByText("User created")).toBeVisible();
    await expect(page.getByText(staff)).toBeVisible();
  });

  test("contact support submits a ticket", async ({ page, baseURL }) => {
    const user = await provisionBusinessOwner(baseURL!, { withProduct: false });
    await loginWithStore(page, user);

    await page.goto("/app/contact");
    await page.getByRole("button", { name: "Other" }).click();
    await page
      .getByPlaceholder("Enter your email address")
      .fill("biz@example.com");
    await page
      .getByPlaceholder("How can we help you?")
      .fill("E2E business support message for playwright coverage.");
    await page.getByRole("button", { name: "Send" }).click();
    await expect(page.getByText("Request sent!")).toBeVisible();
  });

  test("home hub and logout", async ({ page, baseURL }) => {
    const user = await provisionBusinessOwner(baseURL!, { withProduct: false });
    await loginWithStore(page, user);
    await page.goto("/app");
    await expect(page.getByRole("link", { name: /Team/i })).toBeVisible();

    await page.evaluate(async () => {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "same-origin",
      });
    });
    await page.goto("/login");
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole("button", { name: "Log in" })).toBeVisible();
  });
});

import { test, expect } from "@playwright/test";
import { assertNoNextJsOverlay } from "./helpers/auth";
import {
  createBuyListViaPage,
  expectBottomNav,
  loginWithStore,
  openExpiryShowingAll,
  provisionHomeOwner,
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

test.describe("Home user end-to-end", () => {
  test("home shell: Cart nav, Expiry title, no Document", async ({
    page,
    baseURL,
  }) => {
    const user = await provisionHomeOwner(baseURL!);
    await loginWithStore(page, user);

    await page.goto(`/app/expiry?storeId=${user.storeId}`);
    await expect(page.getByRole("heading", { name: "Expiry" })).toBeVisible();
    await expectBottomNav(page, "home");
    await assertNoNextJsOverlay(page);
  });

  test("scan known product into expiry list", async ({ page, baseURL }) => {
    const user = await provisionHomeOwner(baseURL!);
    await loginWithStore(page, user);

    await scanKnownProductToExpiry(
      page,
      user.storeId,
      user.barcode,
      user.productName,
    );
    await expect(page.getByText(user.productName)).toBeVisible();
  });

  test("expiry list shows scanned item and can remove it", async ({
    page,
    baseURL,
  }) => {
    const user = await provisionHomeOwner(baseURL!);
    await loginWithStore(page, user);

    await scanKnownProductToExpiry(
      page,
      user.storeId,
      user.barcode,
      user.productName,
    );
    await openExpiryShowingAll(page, user.storeId);
    const card = page.getByRole("article").filter({ hasText: user.productName });
    await expect(card).toBeVisible();

    await card.getByRole("button", { name: "Remove", exact: true }).click();
    const confirm = page.getByRole("dialog");
    await confirm.getByRole("button", { name: "Remove", exact: true }).click();

    await expect(page.getByText(user.productName)).toHaveCount(0);
    await assertNoNextJsOverlay(page);
  });

  test("cart: list item, mark bought, and favourites section loads", async ({
    page,
    baseURL,
  }) => {
    const user = await provisionHomeOwner(baseURL!);
    await loginWithStore(page, user);
    await createBuyListViaPage(page, {
      storeId: user.storeId,
      barcode: user.barcode,
      productId: user.productId,
    });

    await page.goto(`/app/orders?storeId=${user.storeId}`);
    await expect(page.getByRole("heading", { name: "Cart" })).toBeVisible();
    await expect(page.getByText(user.productName)).toBeVisible();
    await page.getByRole("checkbox", { name: "Mark as bought" }).click();
    await expect(page.getByRole("checkbox", { checked: true })).toBeVisible();
    await assertNoNextJsOverlay(page);
  });

  test("document scan redirects home users to expiry", async ({
    page,
    baseURL,
  }) => {
    const user = await provisionHomeOwner(baseURL!, { withProduct: false });
    await loginWithStore(page, user);
    await page.goto(`/app/add-document?storeId=${user.storeId}`);
    await expect(page).toHaveURL(/\/app\/expiry/);
    await expect(page.getByRole("heading", { name: "Expiry" })).toBeVisible();
  });

  test("team owner can create a staff user", async ({ page, baseURL }) => {
    const user = await provisionHomeOwner(baseURL!, { withProduct: false });
    await loginWithStore(page, user);
    const staff = uniqueUsername("hs");

    await page.goto("/app/team");
    await expect(page.getByRole("heading", { name: "Team" })).toBeVisible();
    await expect(page.getByText(user.username)).toBeVisible();

    await fillTeamCreateForm(page, staff);
    await expect(page.getByText("User created")).toBeVisible();
    await expect(page.getByText(staff)).toBeVisible();
    await assertNoNextJsOverlay(page);
  });

  test("contact support submits a ticket", async ({ page, baseURL }) => {
    const user = await provisionHomeOwner(baseURL!, { withProduct: false });
    await loginWithStore(page, user);

    await page.goto("/app/contact");
    await expect(
      page.getByRole("heading", { name: "Contact Support" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Bug" }).click();
    await page.getByPlaceholder("Enter your email address").fill("home@example.com");
    await page
      .getByPlaceholder("How can we help you?")
      .fill("E2E home support message for playwright coverage.");
    await page.getByRole("button", { name: "Send" }).click();
    await expect(page.getByText("Request sent!")).toBeVisible();
    await assertNoNextJsOverlay(page);
  });

  test("home hub shows Team and Contact cards", async ({ page, baseURL }) => {
    const user = await provisionHomeOwner(baseURL!, { withProduct: false });
    await loginWithStore(page, user);
    await page.goto("/app");
    await expect(page.getByRole("link", { name: /Team/i })).toBeVisible();
    await expect(
      page.getByRole("link", { name: /Contact support/i }),
    ).toBeVisible();

    await page.evaluate(async () => {
      await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
    });
    await page.goto("/login");
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole("button", { name: "Log in" })).toBeVisible();
  });
});

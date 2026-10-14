import { test, expect, type Page } from "@playwright/test";
import { assertNoNextJsOverlay } from "./helpers/auth";
import {
  loginWithStore,
  openExpiryShowingAll,
  provisionBusinessOwner,
  provisionHomeOwner,
  scanKnownProductToExpiry,
} from "./helpers/provision";

function cardFor(page: Page, productName: string) {
  return page.getByRole("article").filter({ hasText: productName });
}

test.describe("Expiry list", () => {
  test("search filters the list and reports no matches", async ({
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

    const search = page.getByLabel("Search by name or barcode");
    await search.fill(user.productName);
    await expect(cardFor(page, user.productName)).toBeVisible();

    await search.fill("zzz-nothing-matches");
    await expect(
      page.getByText("No matching items in the expiry window."),
    ).toBeVisible();

    await search.fill(user.barcode);
    await expect(cardFor(page, user.productName)).toBeVisible();
    await assertNoNextJsOverlay(page);
  });

  test("period filters keep a near-term item visible", async ({
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

    await page.goto(`/app/expiry?storeId=${user.storeId}`);
    await expect(page.getByRole("heading", { name: "Expiry" })).toBeVisible();

    // Item expires in 14 days: inside 1 month / 3 months / All, outside 2 weeks.
    for (const period of ["1 month", "3 months", "All"]) {
      await page.getByRole("button", { name: period, exact: true }).click();
      await expect(cardFor(page, user.productName)).toBeVisible();
    }
    await assertNoNextJsOverlay(page);
  });

  test("detail sheet saves a quantity change", async ({ page, baseURL }) => {
    const user = await provisionHomeOwner(baseURL!);
    await loginWithStore(page, user);
    await scanKnownProductToExpiry(
      page,
      user.storeId,
      user.barcode,
      user.productName,
    );
    await openExpiryShowingAll(page, user.storeId);

    await cardFor(page, user.productName)
      .getByRole("button", { name: "View item details" })
      .click();

    const sheet = page.getByRole("dialog");
    await expect(sheet.getByRole("textbox", { name: "Change quantity" })).toHaveValue(
      "1",
    );
    await sheet.getByRole("button", { name: "Increase quantity" }).click();
    await expect(sheet.getByRole("textbox", { name: "Change quantity" })).toHaveValue(
      "2",
    );

    const save = sheet.getByRole("button", { name: "Save Changes" });
    await expect(save).toBeEnabled();
    await save.click();

    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(cardFor(page, user.productName)).toContainText("2");
    await assertNoNextJsOverlay(page);

    // The change survives a reload, so it really reached the server.
    await openExpiryShowingAll(page, user.storeId);
    await cardFor(page, user.productName)
      .getByRole("button", { name: "View item details" })
      .click();
    await expect(
      page.getByRole("dialog").getByRole("textbox", { name: "Change quantity" }),
    ).toHaveValue("2");
  });

  test("household: favourite toggles and the item can be added to the cart", async ({
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

    const card = cardFor(page, user.productName);
    await card.getByRole("button", { name: "Add to favourites" }).click();
    await expect(
      card.getByRole("button", { name: "Remove from favourites" }),
    ).toBeVisible();

    await card.getByRole("button", { name: "Add to cart" }).click();
    const confirm = page.getByRole("dialog");
    await expect(confirm).toContainText("Add to cart?");
    await confirm.getByRole("button", { name: "Add", exact: true }).click();
    await expect(page.getByText("Added to cart")).toBeVisible();

    // The item stays in expiry and also shows up in the cart.
    await expect(cardFor(page, user.productName)).toBeVisible();
    await page.goto(`/app/orders?storeId=${user.storeId}`);
    await expect(cardFor(page, user.productName)).toBeVisible();
    await expect(
      page
        .getByRole("region", { name: "Favourites" })
        .getByRole("button", { name: user.productName, exact: true }),
    ).toBeVisible();
    await assertNoNextJsOverlay(page);
  });

  test("retail: price reduction is applied and can be edited away", async ({
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

    const card = cardFor(page, user.productName);
    await card.getByRole("button", { name: "Reduce price" }).click();
    await expect(page.getByText("Confirm price reduction")).toBeVisible();
    await page.getByRole("button", { name: "Increase discount" }).click();
    // The card's button is icon-only, so match the labelled one in the sheet.
    await page.locator('button:has-text("Reduce price")').click();

    await expect(card.getByRole("button", { name: "Edit discount" })).toBeVisible();
    await assertNoNextJsOverlay(page);

    await card.getByRole("button", { name: "Edit discount" }).click();
    await expect(page.getByText("Edit discount")).toBeVisible();
    await page.getByRole("button", { name: "Remove discount" }).click();
    await expect(card.getByRole("button", { name: "Reduce price" })).toBeVisible();
  });
});

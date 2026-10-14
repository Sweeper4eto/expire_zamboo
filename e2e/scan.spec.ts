import { test, expect, type Page } from "@playwright/test";
import { assertNoNextJsOverlay } from "./helpers/auth";
import {
  loginWithStore,
  openScanReady,
  provisionBusinessOwner,
} from "./helpers/provision";

const UNKNOWN_BARCODE = "9999999999999";

function waitForResolve(page: Page) {
  return page.waitForResponse(
    (res) =>
      res.url().includes("/api/products/resolve") &&
      res.request().method() === "POST",
  );
}

/**
 * Resolve falls back to Open Food Facts, whose catalog is external and changes,
 * so stub the miss instead of hunting for a barcode nobody has published.
 */
async function stubResolveAsMissing(page: Page, barcode: string) {
  await page.route("**/api/products/resolve", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ status: "missing", barcode }),
    }),
  );
}

async function enterManualBarcode(page: Page, barcode: string) {
  const input = page.getByTestId("barcode-manual-input");
  await input.click();
  await input.fill("");
  await input.pressSequentially(barcode);
  await expect(page.getByTestId("scanner-confirm-barcode")).toBeEnabled();
}

test.describe("Scan flow", () => {
  test("URL barcode triggers lookup and shows product without error page", async ({
    page,
    baseURL,
  }) => {
    const user = await provisionBusinessOwner(baseURL!);
    await loginWithStore(page, user);

    const resolvePromise = waitForResolve(page);
    await openScanReady(page, user.storeId, user.barcode);
    const response = await resolvePromise;

    expect(response.ok()).toBeTruthy();
    const body = (await response.json()) as {
      status?: string;
      product?: { name: string };
    };
    expect(body.status).toBe("found");
    expect(body.product?.name).toBe(user.productName);

    await expect(page.getByText(user.productName)).toBeVisible();
    // Known products skip the name step and land on the expiry date step.
    await expect(page.getByLabel("Selected Date")).toBeVisible();
    await assertNoNextJsOverlay(page);
  });

  test("URL barcode for unknown product shows missing prompt without error page", async ({
    page,
    baseURL,
  }) => {
    const user = await provisionBusinessOwner(baseURL!, { withProduct: false });
    await loginWithStore(page, user);
    await stubResolveAsMissing(page, UNKNOWN_BARCODE);

    const resolvePromise = waitForResolve(page);
    await openScanReady(page, user.storeId, UNKNOWN_BARCODE);
    const response = await resolvePromise;

    expect(response.ok()).toBeTruthy();

    await expect(
      page.getByRole("heading", { name: "Product not found" }),
    ).toBeVisible();
    await assertNoNextJsOverlay(page);
  });

  test("manual barcode confirm shows product without error page", async ({
    page,
    baseURL,
  }) => {
    const user = await provisionBusinessOwner(baseURL!);
    await loginWithStore(page, user);
    await openScanReady(page, user.storeId);

    await enterManualBarcode(page, user.barcode);

    const resolvePromise = waitForResolve(page);
    await page.getByTestId("scanner-confirm-barcode").click();
    const response = await resolvePromise;

    expect(response.ok()).toBeTruthy();
    await expect(page.getByText(user.productName)).toBeVisible();
    await expect(page.getByLabel("Selected Date")).toBeVisible();
    await assertNoNextJsOverlay(page);
  });

  test("manual barcode confirm for unknown product shows missing prompt without error page", async ({
    page,
    baseURL,
  }) => {
    const user = await provisionBusinessOwner(baseURL!, { withProduct: false });
    await loginWithStore(page, user);
    await stubResolveAsMissing(page, UNKNOWN_BARCODE);
    await openScanReady(page, user.storeId);

    await enterManualBarcode(page, UNKNOWN_BARCODE);
    await page.getByTestId("scanner-confirm-barcode").click();

    await expect(
      page.getByRole("heading", { name: "Product not found" }),
    ).toBeVisible();
    await assertNoNextJsOverlay(page);
  });

  test("skip on missing product returns to scan screen (URL barcode)", async ({
    page,
    baseURL,
  }) => {
    const user = await provisionBusinessOwner(baseURL!, { withProduct: false });
    await loginWithStore(page, user);
    await stubResolveAsMissing(page, UNKNOWN_BARCODE);

    await openScanReady(page, user.storeId, UNKNOWN_BARCODE);
    await expect(
      page.getByRole("heading", { name: "Product not found" }),
    ).toBeVisible();

    await page.getByRole("button", { name: "Skip" }).click();

    await expect(
      page.getByRole("heading", { name: "Product not found" }),
    ).not.toBeVisible();
    await expect(page.getByTestId("barcode-manual-input")).toBeVisible();
    await assertNoNextJsOverlay(page);
  });

  test("skip on missing product returns to scan screen (manual barcode)", async ({
    page,
    baseURL,
  }) => {
    const user = await provisionBusinessOwner(baseURL!, { withProduct: false });
    await loginWithStore(page, user);
    await stubResolveAsMissing(page, UNKNOWN_BARCODE);
    await openScanReady(page, user.storeId);

    await enterManualBarcode(page, UNKNOWN_BARCODE);
    await page.getByTestId("scanner-confirm-barcode").click();
    await expect(
      page.getByRole("heading", { name: "Product not found" }),
    ).toBeVisible();

    await page.getByRole("button", { name: "Skip" }).click();

    await expect(
      page.getByRole("heading", { name: "Product not found" }),
    ).not.toBeVisible();
    await expect(page.getByTestId("barcode-manual-input")).toBeVisible();
    await assertNoNextJsOverlay(page);
  });
});

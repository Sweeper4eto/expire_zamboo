import { test, expect, type Page } from "@playwright/test";
import { assertNoNextJsOverlay } from "./helpers/auth";
import {
  futureExpiryIso,
  loginWithStore,
  openExpiryShowingAll,
  provisionBusinessOwner,
  uniqueBarcode,
} from "./helpers/provision";
import { documentPhotoJpeg } from "./helpers/document-photo";

function ymd(days: number) {
  return futureExpiryIso(days).slice(0, 10);
}

/**
 * OCR itself is an external AI call, so the rows are stubbed. Everything after
 * the stub — review UI, edits, and /api/documents/import — runs for real.
 */
async function stubParse(
  page: Page,
  rows: {
    name: string;
    barcode?: string | null;
    articul?: string | null;
    expiryYmd?: string | null;
    quantity?: number;
  }[],
) {
  await page.route("**/api/documents/parse", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        items: rows.map((row) => ({
          name: row.name,
          barcode: row.barcode ?? null,
          articul: row.articul ?? null,
          expiryYmd: row.expiryYmd ?? null,
          quantity: row.quantity ?? 1,
          productId: null,
          matchSource: null,
        })),
      }),
    }),
  );
}

async function uploadDocumentPhoto(page: Page) {
  await page.setInputFiles('input[type="file"][multiple]', {
    name: "delivery.jpg",
    mimeType: "image/jpeg",
    buffer: await documentPhotoJpeg(),
  });
  await page.getByRole("button", { name: "Next" }).click();
}

test.describe("Document import", () => {
  test("household accounts are redirected away", async ({ page, baseURL }) => {
    const { provisionHomeOwner } = await import("./helpers/provision");
    const user = await provisionHomeOwner(baseURL!, { withProduct: false });
    await loginWithStore(page, user);

    await page.goto(`/app/add-document?storeId=${user.storeId}`);
    await expect(page).toHaveURL(/\/app\/expiry/);
  });

  test("upload, review, and import a delivery list", async ({
    page,
    baseURL,
  }) => {
    const user = await provisionBusinessOwner(baseURL!, { withProduct: false });
    const firstName = `Doc Milk ${Date.now().toString(36).slice(-4)}`;
    const secondName = `Doc Bread ${Date.now().toString(36).slice(-4)}`;

    await loginWithStore(page, user);
    await stubParse(page, [
      { name: firstName, barcode: uniqueBarcode(), quantity: 4, expiryYmd: ymd(12) },
      { name: secondName, barcode: uniqueBarcode(), quantity: 2, expiryYmd: ymd(20) },
    ]);

    await page.goto(`/app/add-document?storeId=${user.storeId}`);
    await uploadDocumentPhoto(page);

    await expect(page.getByRole("heading", { name: "Review items" })).toBeVisible();
    await expect(page.getByText(firstName)).toBeVisible();
    await expect(page.getByText(secondName)).toBeVisible();

    const search = page.getByLabel("Search item or barcode");
    await search.fill(firstName);
    await expect(page.getByText(secondName)).toHaveCount(0);
    await search.fill("");

    await page.getByRole("button", { name: "Add items" }).click();

    await expect(
      page.getByRole("heading", { name: "Import complete" }),
    ).toBeVisible();
    await assertNoNextJsOverlay(page);

    await page.getByRole("button", { name: "Go to expiry list" }).click();
    await openExpiryShowingAll(page, user.storeId);
    await expect(page.getByText(firstName)).toBeVisible();
    await expect(page.getByText(secondName)).toBeVisible();
  });

  test("a row can be dropped before importing", async ({ page, baseURL }) => {
    const user = await provisionBusinessOwner(baseURL!, { withProduct: false });
    const keepName = `Doc Keep ${Date.now().toString(36).slice(-4)}`;
    const dropName = `Doc Drop ${Date.now().toString(36).slice(-4)}`;

    await loginWithStore(page, user);
    await stubParse(page, [
      { name: keepName, barcode: uniqueBarcode(), quantity: 1, expiryYmd: ymd(10) },
      { name: dropName, barcode: uniqueBarcode(), quantity: 1, expiryYmd: ymd(10) },
    ]);

    await page.goto(`/app/add-document?storeId=${user.storeId}`);
    await uploadDocumentPhoto(page);
    await expect(page.getByRole("heading", { name: "Review items" })).toBeVisible();

    await page
      .getByRole("article")
      .filter({ hasText: dropName })
      .getByRole("button", { name: "Remove" })
      .click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Remove", exact: true })
      .click();
    await expect(page.getByText(dropName)).toHaveCount(0);

    await page.getByRole("button", { name: "Add items" }).click();
    await expect(
      page.getByRole("heading", { name: "Import complete" }),
    ).toBeVisible();

    await openExpiryShowingAll(page, user.storeId);
    await expect(page.getByText(keepName)).toBeVisible();
    await expect(page.getByText(dropName)).toHaveCount(0);
  });

  test("rows without a date block the import until removed", async ({
    page,
    baseURL,
  }) => {
    const user = await provisionBusinessOwner(baseURL!, { withProduct: false });
    const goodName = `Doc Dated ${Date.now().toString(36).slice(-4)}`;
    const undatedName = `Doc Undated ${Date.now().toString(36).slice(-4)}`;

    await loginWithStore(page, user);
    await stubParse(page, [
      { name: goodName, barcode: uniqueBarcode(), quantity: 1, expiryYmd: ymd(9) },
      { name: undatedName, barcode: uniqueBarcode(), quantity: 1, expiryYmd: null },
    ]);

    await page.goto(`/app/add-document?storeId=${user.storeId}`);
    await uploadDocumentPhoto(page);
    await expect(page.getByRole("heading", { name: "Review items" })).toBeVisible();

    const importButton = page.getByRole("button", { name: "Add items" });
    await expect(importButton).toBeDisabled();

    await page.getByRole("button", { name: /Remove 1 rows with no expiry date/ }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Remove", exact: true })
      .click();

    await expect(page.getByText(undatedName)).toHaveCount(0);
    await expect(importButton).toBeEnabled();
    await importButton.click();
    await expect(
      page.getByRole("heading", { name: "Import complete" }),
    ).toBeVisible();
    await assertNoNextJsOverlay(page);
  });
});

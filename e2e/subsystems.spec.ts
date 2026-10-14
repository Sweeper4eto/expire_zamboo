import { test, expect } from "@playwright/test";
import { assertNoNextJsOverlay } from "./helpers/auth";
import {
  createBuyListViaPage,
  futureExpiryDmyDigits,
  loginWithStore,
  openExpiryShowingAll,
  provisionBusinessOwner,
  provisionHomeOwner,
  uniqueBarcode,
} from "./helpers/provision";

test.describe("Manual product entry", () => {
  test("a new product is created and handed back to the scan flow", async ({
    page,
    baseURL,
  }) => {
    const user = await provisionBusinessOwner(baseURL!, { withProduct: false });
    const barcode = uniqueBarcode("209");
    const productName = `Manual ${Date.now().toString(36).slice(-4)}`;

    await loginWithStore(page, user);
    // Keep the initial name lookup off the public catalog.
    await page.route("**/api/products/resolve", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ status: "missing", barcode }),
      }),
    );

    await page.goto(
      `/app/add-product?storeId=${user.storeId}&barcode=${barcode}`,
    );
    await page.getByPlaceholder("Product name").fill(productName);
    await page.getByRole("button", { name: "Next" }).click();
    await page.getByRole("button", { name: "Skip photo" }).click();

    await expect(page.getByText(`Barcode: ${barcode}`)).toBeVisible();
    await page.unroute("**/api/products/resolve");
    await page.getByRole("button", { name: "Add", exact: true }).click();

    await expect(page).toHaveURL(/\/app\/scan/);
    await expect(page.getByText(productName)).toBeVisible();
    await expect(page.getByLabel("Selected Date")).toBeVisible();
    await assertNoNextJsOverlay(page);
  });
});

test.describe("Cart", () => {
  test("an item can be marked bought and moved to expiry", async ({
    page,
    baseURL,
  }) => {
    const user = await provisionHomeOwner(baseURL!);
    await loginWithStore(page, user);
    await page.goto("/app");
    await createBuyListViaPage(page, {
      storeId: user.storeId,
      barcode: user.barcode,
      productId: user.productId,
    });

    await page.goto(`/app/orders?storeId=${user.storeId}`);
    const card = page.getByRole("article").filter({ hasText: user.productName });
    await expect(card).toBeVisible();

    await card.getByRole("checkbox", { name: "Mark as bought" }).click();
    await expect(
      card.getByRole("checkbox", { name: "Mark as not bought" }),
    ).toBeChecked();

    await card.getByRole("button", { name: "Move to expiry" }).click();
    await expect(page.getByText("Move to expiry")).toBeVisible();
    const dateField = page.getByLabel("Selected Date");
    await dateField.click();
    for (const digit of futureExpiryDmyDigits(14)) {
      await dateField.press(digit);
    }
    await page.getByRole("button", { name: "Move", exact: true }).click();

    await expect(page.getByText("Moved to expiry")).toBeVisible();
    await expect(page.getByText(user.productName)).toHaveCount(0);

    await openExpiryShowingAll(page, user.storeId);
    await expect(page.getByText(user.productName)).toBeVisible();
    await assertNoNextJsOverlay(page);
  });
});

test.describe("Push notifications", () => {
  test("a user can subscribe and unsubscribe", async ({ page, baseURL }) => {
    const user = await provisionHomeOwner(baseURL!, { withProduct: false });
    await loginWithStore(page, user);
    await page.goto("/app");

    const keyResponse = await page.request.get("/api/push/vapid-public-key");
    expect(keyResponse.ok()).toBeTruthy();
    const { publicKey } = (await keyResponse.json()) as { publicKey?: string };
    expect(publicKey).toBeTruthy();

    const endpoint = `https://push.example.test/e2e/${Date.now()}`;
    const subscribe = await page.request.post("/api/push/subscribe", {
      data: {
        endpoint,
        keys: { p256dh: "BEl62iUYgUivxIkv69yViEuiBIa", auth: "aUxSecret123" },
        locale: "en",
      },
    });
    expect(subscribe.status()).toBe(200);

    const unsubscribe = await page.request.post("/api/push/unsubscribe", {
      data: { endpoint },
    });
    expect(unsubscribe.status()).toBe(200);
  });

  test("subscribing requires a session", async ({ request }) => {
    const response = await request.post("/api/push/subscribe", {
      data: {
        endpoint: "https://push.example.test/anon",
        keys: { p256dh: "x", auth: "y" },
      },
    });
    expect(response.status()).toBe(401);
  });
});

test.describe("Uploads", () => {
  test("an image data URL is stored and served back", async ({
    page,
    baseURL,
  }) => {
    const user = await provisionHomeOwner(baseURL!, { withProduct: false });
    await loginWithStore(page, user);
    await page.goto("/app");

    // 1x1 PNG.
    const dataUrl =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==";
    const upload = await page.request.post("/api/upload", {
      data: { dataUrl },
    });
    expect(upload.ok()).toBeTruthy();
    const { path } = (await upload.json()) as { path: string };
    expect(path).toContain("/uploads/");

    const served = await page.request.get(path);
    expect(served.ok()).toBeTruthy();
  });

  test("uploading requires a session", async ({ request }) => {
    const response = await request.post("/api/upload", {
      data: { dataUrl: "data:image/png;base64,AAAA" },
    });
    expect(response.status()).toBe(401);
  });
});

test.describe("Purge cron", () => {
  test("runs with the shared secret and refuses without it", async ({
    request,
  }) => {
    const forbidden = await request.post("/api/cron/purge-inventory");
    expect(forbidden.status()).toBe(403);

    const ok = await request.post("/api/cron/purge-inventory", {
      headers: { "x-cron-secret": "e2e-cron-secret" },
    });
    expect(ok.status()).toBe(200);
    const body = (await ok.json()) as { purged?: unknown; push?: unknown };
    expect(body.purged).toBeDefined();
    expect(body.push).toBeDefined();
  });
});

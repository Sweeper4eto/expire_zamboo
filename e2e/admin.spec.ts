import { test, expect, type Page } from "@playwright/test";
import {
  assertNoNextJsOverlay,
  loginViaForm,
  registerUserOnFreshContext,
  withAdminApi,
} from "./helpers/auth";
import {
  createBuyListViaPage,
  createInventoryViaPage,
  loginWithStore,
  logoutViaPage,
  provisionBusinessOwner,
  provisionHomeOwner,
  uniqueUsername,
} from "./helpers/provision";

function suffix() {
  return Date.now().toString(36).slice(-5);
}

async function openAdmin(page: Page, tab: string) {
  await loginViaForm(page, "admin", "admin123");
  await expect(page).toHaveURL(/\/admin/);
  await page.getByRole("tab", { name: tab, exact: true }).first().click();
}

test.describe("Admin panel", () => {
  test("creates a client and a location through the forms", async ({
    page,
    baseURL,
  }) => {
    const clientName = `UI Client ${suffix()}`;
    const storeName = `UI Store ${suffix()}`;

    await openAdmin(page, "Accounts");
    await page.getByRole("button", { name: "+ New business", exact: true }).click();
    await page.getByLabel("Name", { exact: true }).fill(clientName);
    await page.getByRole("button", { name: "Create", exact: true }).click();

    await page.getByRole("button", { name: "Accounts", exact: true }).first().click();
    await page.getByRole("button", { name: clientName }).click();
    await page.getByRole("tab", { name: "New location", exact: true }).click();
    await page.getByLabel("Location name").fill(storeName);
    await page.getByLabel("Monthly fee (€)").fill("30");
    await page.getByRole("button", { name: "Add location" }).click();

    await page.getByRole("tab", { name: "Client locations", exact: true }).click();
    await expect(page.getByText(storeName)).toBeVisible();
    await assertNoNextJsOverlay(page);

    // Confirm it is really persisted, not just rendered optimistically.
    const created = await withAdminApi(baseURL!, async (api) => {
      const response = await api.get(
        `/api/admin/clients?q=${encodeURIComponent(clientName)}`,
      );
      const data = (await response.json()) as {
        clients: { name: string; _count: { stores: number } }[];
      };
      return data.clients.find((client) => client.name === clientName);
    });
    expect(created?._count.stores).toBe(1);
  });

  test("assigns a user to a client and location", async ({ page, baseURL }) => {
    const username = uniqueUsername("as");
    await registerUserOnFreshContext(baseURL!, username);
    const clientName = `Assign ${suffix()}`;

    const client = await withAdminApi(baseURL!, async (api) => {
      const created = await api.post("/api/admin/clients", {
        data: { name: clientName, monthlyFeePerStore: 20 },
      });
      const body = (await created.json()) as { client: { id: string } };
      await api.post("/api/admin/stores", {
        data: { clientId: body.client.id, name: "Assign Store" },
      });
      return body.client;
    });
    expect(client.id).toBeTruthy();

    await openAdmin(page, "Accounts");
    await page.getByRole("button", { name: "Users", exact: true }).click();
    await page
      .getByPlaceholder("Search by username, email, client, or location…")
      .fill(username);
    await page.getByRole("button", { name: new RegExp(username) }).click();

    await expect(page.getByText(`User: ${username}`)).toBeVisible();
    await page.getByRole("button", { name: "Client", exact: true }).click();
    await page.getByRole("option", { name: clientName }).click();
    await page.getByRole("checkbox", { name: "Assign Store" }).check();
    await page.getByRole("button", { name: "Save", exact: true }).click();

    await expect(page.getByText("Changes saved successfully.")).toBeVisible();
    await assertNoNextJsOverlay(page);
  });

  test("records a monthly payment", async ({ page, baseURL }) => {
    const business = await provisionBusinessOwner(baseURL!, {
      withProduct: false,
    });

    await openAdmin(page, "Payments");
    const clientCard = page.getByRole("button", {
      name: new RegExp(`Biz .*Unpaid`),
    });
    await clientCard.first().click();

    await page.getByPlaceholder("Discount (€)").fill("5");
    await page.getByPlaceholder("Notes").fill("e2e");
    await page.getByRole("button", { name: "Mark as paid" }).click();

    await expect(page.getByText("Changes saved successfully.")).toBeVisible();
    await assertNoNextJsOverlay(page);
    expect(business.clientId).toBeTruthy();
  });

  test("finds a catalog item in the Items tab", async ({ page, baseURL }) => {
    const business = await provisionBusinessOwner(baseURL!);

    await openAdmin(page, "Items");
    await page.getByPlaceholder("Search...").fill(business.barcode);
    await page.getByRole("button", { name: new RegExp(business.productName) }).click();

    await expect(page.getByLabel("Barcode")).toHaveValue(business.barcode);
    await assertNoNextJsOverlay(page);
  });

  test("audit log lists recorded events", async ({ page, baseURL }) => {
    // Generate at least one auditable action before reading the log.
    await provisionBusinessOwner(baseURL!, { withProduct: false });

    await openAdmin(page, "Audit log");
    await expect(page.getByText(/Showing \d+/)).toBeVisible();
    await page.getByRole("button", { name: "Event type" }).click();
    await page.getByRole("option", { name: "Admin changes" }).click();
    await expect(page.getByText("Client created").first()).toBeVisible();
    await assertNoNextJsOverlay(page);
  });

  test("pushes a What's new announcement that users see once", async ({
    page,
    baseURL,
  }) => {
    const titleEn = `E2E announcement ${suffix()}`;
    const itemId = await withAdminApi(baseURL!, async (api) => {
      const response = await api.post("/api/admin/whats-new", {
        data: { titleEn, titleBg: `БГ ${titleEn}` },
      });
      expect(response.ok()).toBeTruthy();
      const body = (await response.json()) as { item: { id: string } };
      return body.item.id;
    });

    await openAdmin(page, "What's new");
    const row = page.getByRole("row").filter({ hasText: titleEn });
    await row.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Push to users" }).click();
    await expect(
      page.getByText("Selected announcements are now Live for users."),
    ).toBeVisible();
    await logoutViaPage(page);

    const user = await provisionHomeOwner(baseURL!, { withProduct: false });
    await loginWithStore(page, user);
    await page.goto("/app");

    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText(titleEn);
    await dialog.getByRole("button", { name: "Got it" }).click();
    await expect(page.getByText(titleEn)).toHaveCount(0);

    // Dismissing hands over to the install prompt; clear it and reload.
    const install = page.getByRole("dialog", { name: "Add to home screen?" });
    await expect(install).toBeVisible();
    await install.getByRole("button", { name: "Not now" }).click();

    // Seen announcements stay dismissed on the next visit.
    await page.reload();
    await expect(page.getByText(titleEn)).toHaveCount(0);
    await assertNoNextJsOverlay(page);

    // Leave nothing Live: a hub-blocking dialog would break later tests.
    await withAdminApi(baseURL!, async (api) => {
      const response = await api.patch("/api/admin/whats-new", {
        data: { ids: [itemId], action: "delete" },
      });
      expect(response.ok()).toBeTruthy();
    });
  });

  test("store expiry and cart lists show a household store's items", async ({
    page,
    baseURL,
  }) => {
    const user = await provisionHomeOwner(baseURL!);
    await loginWithStore(page, user);
    await page.goto("/app");
    await createInventoryViaPage(page, {
      storeId: user.storeId,
      barcode: user.barcode,
      productId: user.productId,
    });
    await createBuyListViaPage(page, {
      storeId: user.storeId,
      barcode: user.barcode,
      productId: user.productId,
    });
    await logoutViaPage(page);

    await loginViaForm(page, "admin", "admin123");
    await page.goto(`/admin/expiry?storeId=${user.storeId}`);
    await expect(page.getByRole("heading", { name: /Expiry — / })).toBeVisible();
    await expect(
      page.getByRole("article").filter({ hasText: user.productName }),
    ).toBeVisible();

    await page.goto(`/admin/buy-list?storeId=${user.storeId}`);
    await expect(page.getByRole("heading", { name: /Cart — / })).toBeVisible();
    await expect(
      page.getByRole("article").filter({ hasText: user.productName }),
    ).toBeVisible();
    await assertNoNextJsOverlay(page);
  });
});

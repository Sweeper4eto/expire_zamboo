import {
  request as playwrightRequest,
  type APIRequestContext,
  type Page,
  expect,
} from "@playwright/test";
import {
  assignUserViaApi,
  assertNoNextJsOverlay,
  createClientViaApi,
  createProductViaApi,
  createStoreViaApi,
  loginInBrowser,
  registerUserOnFreshContext,
  registerUserViaApi,
  withAdminApi,
} from "./auth";

export const DEFAULT_PASSWORD = "password123";

/** Usernames are capped at 20 chars. */
export function uniqueUsername(prefix: string): string {
  const suffix = Date.now().toString(36).slice(-7);
  return `${prefix}${suffix}`.slice(0, 20);
}

let barcodeSequence = 0;

/** EAN-13 length, unique even when called twice in the same millisecond. */
export function uniqueBarcode(prefix = "590"): string {
  barcodeSequence = (barcodeSequence + 1) % 100;
  const stamp = String(Date.now()).slice(-8);
  return `${prefix}${stamp}${String(barcodeSequence).padStart(2, "0")}`;
}

export function futureExpiryIso(daysAhead = 14): string {
  return new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000).toISOString();
}

/** DDMMYYYY digits for the expiry date mask (e.g. 31122027). */
export function futureExpiryDmyDigits(daysAhead = 14): string {
  const d = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = String(d.getFullYear());
  return `${dd}${mm}${yyyy}`;
}

export type ProvisionedUser = {
  username: string;
  password: string;
  userId: string;
  storeId: string;
  storeName: string;
  clientId: string;
  homeUser: boolean;
  barcode: string;
  productId: string;
  productName: string;
};

async function fetchMeStores(api: APIRequestContext) {
  const me = await api.get("/api/auth/me");
  if (!me.ok()) {
    throw new Error(`auth/me failed: ${await me.text()}`);
  }
  const data = (await me.json()) as {
    user: {
      id: string;
      clientId: string | null;
      homeUser: boolean;
      stores: { id: string; name: string }[];
    } | null;
  };
  if (!data.user?.stores?.[0] || !data.user.clientId) {
    throw new Error("Expected user with at least one store");
  }
  return {
    userId: data.user.id,
    clientId: data.user.clientId,
    storeId: data.user.stores[0].id,
    storeName: data.user.stores[0].name,
    homeUser: data.user.homeUser,
  };
}

/** Household owner via public register (own Home store). */
export async function provisionHomeOwner(
  baseURL: string,
  opts?: { withProduct?: boolean },
): Promise<ProvisionedUser> {
  const username = uniqueUsername("h");
  const barcode = uniqueBarcode();
  const productName = `Home Product ${Date.now().toString(36).slice(-4)}`;
  const withProduct = opts?.withProduct !== false;

  const ctx = await playwrightRequest.newContext({ baseURL });
  try {
    const user = await registerUserViaApi(ctx, username);
    const me = await fetchMeStores(ctx);
    let productId = "";
    if (withProduct) {
      const product = await createProductViaApi(ctx, barcode, productName);
      productId = product.id;
    }
    return {
      username,
      password: DEFAULT_PASSWORD,
      userId: user.id,
      storeId: me.storeId,
      storeName: me.storeName,
      clientId: me.clientId,
      homeUser: true,
      barcode,
      productId,
      productName,
    };
  } finally {
    await ctx.dispose();
  }
}

/**
 * Business owner: admin creates client/store, user registers on a separate
 * context (so admin session stays valid), then admin assigns OWNER + stores.
 */
export async function provisionBusinessOwner(
  baseURL: string,
  opts?: { withProduct?: boolean },
): Promise<ProvisionedUser> {
  const username = uniqueUsername("b");
  const barcode = uniqueBarcode();
  const productName = `Biz Product ${Date.now().toString(36).slice(-4)}`;
  const withProduct = opts?.withProduct !== false;

  return withAdminApi(baseURL, async (admin) => {
    const client = await createClientViaApi(
      admin,
      `Biz ${Date.now().toString(36).slice(-6)}`,
    );
    const store = await createStoreViaApi(admin, client.id, "Main");

    const user = await registerUserOnFreshContext(baseURL, username);
    await assignUserViaApi(admin, user.id, client.id, [store.id], "OWNER");

    let productId = "";
    if (withProduct) {
      // Product catalog is global; create as admin.
      const product = await createProductViaApi(admin, barcode, productName);
      productId = product.id;
    }

    return {
      username,
      password: DEFAULT_PASSWORD,
      userId: user.id,
      storeId: store.id,
      storeName: store.name,
      clientId: client.id,
      homeUser: false,
      barcode,
      productId,
      productName,
    };
  });
}

/** Owner-only: create a staff/owner teammate through the team API. */
export async function createTeamUserViaPage(
  page: Page,
  input: {
    username: string;
    password?: string;
    storeIds?: string[];
    clientRole?: "OWNER" | "MEMBER";
  },
): Promise<void> {
  const payload = {
    username: input.username,
    password: input.password ?? DEFAULT_PASSWORD,
    storeIds: input.storeIds ?? [],
    ...(input.clientRole ? { clientRole: input.clientRole } : {}),
  };
  const result = await page.evaluate(async (body) => {
    const response = await fetch("/api/team/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(body),
    });
    const text = await response.text();
    return { ok: response.ok, status: response.status, text };
  }, payload);
  if (!result.ok) {
    throw new Error(`team user create failed (${result.status}): ${result.text}`);
  }
}

/**
 * Logout without depending on the header button. Clears the sessionStorage
 * mirror as the UI does, otherwise the next load restores the session cookie.
 */
export async function logoutViaPage(page: Page): Promise<void> {
  // Leave /app first: its mirror effects would write the session cookie back
  // from the ?__session= token that is still in the URL.
  await page.goto("/terms");
  await page.evaluate(async () => {
    await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "same-origin",
    });
    sessionStorage.removeItem("magazin_session_client");
    document.cookie = "magazin_session_client=; Path=/; Max-Age=0; SameSite=Lax";
  });
  await page.context().clearCookies();
  await page.goto("/login");
  await expect(page.getByRole("button", { name: /Log in|Вход/ })).toBeVisible();
}

/**
 * Pin the UI language before the first request: the cookie drives server
 * rendering, localStorage drives the client providers.
 */
export async function useLocale(
  page: Page,
  locale: "en" | "bg",
  baseURL: string,
): Promise<void> {
  await page.context().addCookies([
    { name: "magazin-locale", value: locale, url: baseURL },
  ]);
  await page.addInitScript((value) => {
    localStorage.setItem("magazin-locale", value);
  }, locale);
}

/**
 * A first visit to /app offers the "add to home screen" dialog, which covers
 * the hub. Look like a user who already declined it.
 */
export async function skipPwaInstallPrompt(page: Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem("expire365-pwa-install-dismissed", "1");
  });
}

export async function selectStore(page: Page, storeId: string): Promise<void> {
  await page.evaluate((id) => {
    localStorage.setItem("magazin_selected_store", id);
    window.dispatchEvent(new Event("magazin:store-changed"));
  }, storeId);
}

export async function loginWithStore(
  page: Page,
  user: Pick<ProvisionedUser, "username" | "password" | "storeId">,
): Promise<void> {
  await loginInBrowser(page, user.username, user.password);
  await selectStore(page, user.storeId);
}

export async function createInventoryViaPage(
  page: Page,
  input: {
    storeId: string;
    barcode: string;
    productId: string;
    quantity?: number;
    expiryDate?: string;
  },
): Promise<void> {
  const payload = {
    storeId: input.storeId,
    barcode: input.barcode,
    productId: input.productId,
    quantity: input.quantity ?? 2,
    expiryDate: input.expiryDate ?? futureExpiryIso(14),
  };
  const result = await page.evaluate(async (body) => {
    const response = await fetch("/api/inventory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(body),
    });
    const text = await response.text();
    return { ok: response.ok, status: response.status, text };
  }, payload);
  if (!result.ok) {
    throw new Error(`inventory create failed (${result.status}): ${result.text}`);
  }
}

export async function createBuyListViaPage(
  page: Page,
  input: {
    storeId: string;
    barcode: string;
    productId: string;
    quantity?: number;
  },
): Promise<void> {
  const payload = {
    storeId: input.storeId,
    barcode: input.barcode,
    productId: input.productId,
    quantity: input.quantity ?? 1,
  };
  const result = await page.evaluate(async (body) => {
    const response = await fetch("/api/buy-list", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(body),
    });
    const text = await response.text();
    return { ok: response.ok, status: response.status, text };
  }, payload);
  if (!result.ok) {
    throw new Error(`buy-list create failed (${result.status}): ${result.text}`);
  }
}

export async function openScanReady(
  page: Page,
  storeId: string,
  barcode?: string,
): Promise<void> {
  const query = new URLSearchParams({ storeId });
  if (barcode) query.set("barcode", barcode);
  await page.goto(`/app/scan?${query.toString()}`, {
    waitUntil: "domcontentloaded",
  });
  await expect(page.getByTestId("scan-flow-ready")).toBeVisible();
}

/** Known product via URL barcode → date step (skips name) → Save to Expiry List. */
export async function scanKnownProductToExpiry(
  page: Page,
  storeId: string,
  barcode: string,
  productName: string,
): Promise<void> {
  await openScanReady(page, storeId, barcode);
  await expect(page.getByText(productName)).toBeVisible();
  // Found products jump straight to the date step (no Next).
  await expect(page.getByLabel("Selected Date")).toBeVisible();
  // Keep expiry inside the default 1-month list window.
  const digits = futureExpiryDmyDigits(14);
  await page.getByLabel("Selected Date").click();
  for (const ch of digits) {
    await page.getByLabel("Selected Date").press(ch);
  }
  await expect(
    page.getByRole("button", { name: "Save to Expiry List" }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Save to Expiry List" }).click();
  await expect(page).toHaveURL(/\/app\/expiry/);
  await assertNoNextJsOverlay(page);
}

export async function expectBottomNav(
  page: Page,
  kind: "home" | "business",
): Promise<void> {
  const nav = page.getByRole("navigation", { name: /main navigation/i });
  await expect(nav.getByRole("link", { name: "Expiry" })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Add" })).toBeVisible();
  if (kind === "home") {
    await expect(nav.getByRole("link", { name: "Cart" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Document" })).toHaveCount(0);
  } else {
    await expect(nav.getByRole("link", { name: "Document" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Cart" })).toHaveCount(0);
  }
}

/** Open expiry and force the All period so seeded items always appear. */
export async function openExpiryShowingAll(
  page: Page,
  storeId: string,
): Promise<void> {
  await page.goto(`/app/expiry?storeId=${storeId}`);
  await expect(
    page.getByRole("heading", { name: /Expiry|Store Expiry List/i }),
  ).toBeVisible();
  await page.getByRole("button", { name: "All", exact: true }).click();
}

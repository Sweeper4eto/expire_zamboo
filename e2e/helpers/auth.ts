import {
  expect,
  request as playwrightRequest,
  type APIRequestContext,
  type Page,
} from "@playwright/test";

async function createAdminApiContext(baseURL: string): Promise<APIRequestContext> {
  const context = await playwrightRequest.newContext({ baseURL });
  const response = await context.post("/api/auth/login", {
    data: { username: "admin", password: "admin123" },
  });
  if (!response.ok()) {
    await context.dispose();
    throw new Error(`Admin login failed: ${await response.text()}`);
  }
  return context;
}

/** Fails if the Next.js client error overlay is present (React runtime/console errors). */
export async function assertNoNextJsOverlay(page: Page): Promise<void> {
  await expect(
    page.getByText(
      /Encountered a script tag|Unhandled Runtime Error|Application error: a client-side exception|Console Error/i,
    ),
  ).toHaveCount(0);
  await expect(page.locator("[data-nextjs-dialog]")).toHaveCount(0);
}

/**
 * Real form POST login (same path users use). Prefer this when testing /login itself.
 * Faster API-cookie login remains in {@link loginInBrowser} for unrelated UI tests.
 */
export async function loginViaForm(
  page: Page,
  username: string,
  password: string,
): Promise<void> {
  await page.goto("/login");
  await page.waitForLoadState("domcontentloaded");
  await expect(page.getByRole("button", { name: "Log in" })).toBeVisible();
  await assertNoNextJsOverlay(page);

  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
}

/** API login + navigate — skips form/hydration. Use when the test is not about login UI. */
export async function loginInBrowser(
  page: Page,
  username: string,
  password: string,
): Promise<void> {
  await page.goto("/login");
  await page.waitForLoadState("domcontentloaded");

  const result = await page.evaluate(
    async ({ user, pass }) => {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: user, password: pass }),
      });
      const body = await response.json();
      return { ok: response.ok, body };
    },
    { user: username, pass: password },
  );

  if (!result.ok) {
    throw new Error(`Login failed: ${JSON.stringify(result.body)}`);
  }

  const destination = result.body.user.role === "ADMIN" ? "/admin" : "/app";
  await page.goto(destination);
}

export async function withAdminApi<T>(
  baseURL: string,
  run: (api: APIRequestContext) => Promise<T>,
): Promise<T> {
  const api = await createAdminApiContext(baseURL);
  try {
    return await run(api);
  } finally {
    await api.dispose();
  }
}

export async function createClientViaApi(
  request: APIRequestContext,
  name: string,
  monthlyFeePerStore = 20,
) {
  const response = await request.post("/api/admin/clients", {
    data: { name, monthlyFeePerStore },
  });
  if (!response.ok()) {
    throw new Error(`Create client failed: ${await response.text()}`);
  }
  const data = await response.json();
  return data.client as { id: string; name: string };
}

export async function createStoreViaApi(
  request: APIRequestContext,
  clientId: string,
  name: string,
) {
  const response = await request.post("/api/admin/stores", {
    data: { clientId, name },
  });
  if (!response.ok()) {
    throw new Error(`Create store failed: ${await response.text()}`);
  }
  const data = await response.json();
  return data.store as { id: string; name: string };
}

export async function registerUserViaApi(
  request: APIRequestContext,
  username: string,
  password = "password123",
  accountType: "home" | "retail" = "home",
  organizationName?: string,
) {
  let lastError = "";
  for (let attempt = 1; attempt <= 3; attempt++) {
    const response = await request.post("/api/auth/register", {
      data: {
        username,
        password,
        accountType,
        ...(organizationName ? { organizationName } : {}),
      },
    });
    if (response.ok()) {
      const data = await response.json();
      return data.user as { id: string; username: string };
    }
    lastError = await response.text();
    if (attempt < 3) await new Promise((r) => setTimeout(r, 750 * attempt));
  }
  throw new Error(`Register failed: ${lastError}`);
}

/**
 * Register on a throwaway context: `/api/auth/register` logs the new user in, so
 * reusing an admin context here would replace the admin session cookie.
 */
export async function registerUserOnFreshContext(
  baseURL: string,
  username: string,
  password = "password123",
  accountType: "home" | "retail" = "home",
  organizationName?: string,
) {
  const context = await playwrightRequest.newContext({ baseURL });
  try {
    return await registerUserViaApi(
      context,
      username,
      password,
      accountType,
      organizationName,
    );
  } finally {
    await context.dispose();
  }
}

export async function assignUserViaApi(
  request: APIRequestContext,
  userId: string,
  clientId: string,
  storeIds: string[],
  clientRole: "OWNER" | "MEMBER" = "OWNER",
) {
  let lastError = "";
  for (let attempt = 1; attempt <= 3; attempt++) {
    const response = await request.patch("/api/admin/users", {
      data: { userId, clientId, storeIds, active: true, clientRole },
    });
    if (response.ok()) return;
    lastError = await response.text();
    if (attempt < 3) await new Promise((r) => setTimeout(r, 750 * attempt));
  }
  throw new Error(`Assign user failed: ${lastError}`);
}

/** Admin sets a temporary password; the user must then choose a new one. */
export async function setUserPasswordViaApi(
  request: APIRequestContext,
  userId: string,
  password: string,
) {
  const response = await request.post("/api/admin/users/password", {
    data: { userId, password, confirmPassword: password },
  });
  if (!response.ok()) {
    throw new Error(`Set password failed: ${await response.text()}`);
  }
}

export async function createProductViaApi(
  request: APIRequestContext,
  barcode: string,
  name: string,
) {
  let lastError = "";
  for (let attempt = 1; attempt <= 3; attempt++) {
    const response = await request.post("/api/products", {
      data: { barcode, name },
    });
    if (response.ok()) {
      const data = await response.json();
      return data.product as { id: string; barcode: string; name: string };
    }
    lastError = await response.text();
    if (attempt < 3) await new Promise((r) => setTimeout(r, 750 * attempt));
  }
  throw new Error(`Create product failed: ${lastError}`);
}

import { test, expect } from "@playwright/test";
import { assertNoNextJsOverlay } from "./helpers/auth";
import {
  createTeamUserViaPage,
  loginWithStore,
  logoutViaPage,
  provisionBusinessOwner,
  uniqueUsername,
  DEFAULT_PASSWORD,
} from "./helpers/provision";

/** Owner creates a teammate, then the test switches to that teammate's session. */
async function asTeammate(
  page: import("@playwright/test").Page,
  baseURL: string,
  clientRole: "OWNER" | "MEMBER",
) {
  const owner = await provisionBusinessOwner(baseURL, { withProduct: false });
  await loginWithStore(page, owner);

  const username = uniqueUsername(clientRole === "OWNER" ? "co" : "st");
  await createTeamUserViaPage(page, {
    username,
    storeIds: [owner.storeId],
    clientRole,
  });

  await logoutViaPage(page);
  await loginWithStore(page, {
    username,
    password: DEFAULT_PASSWORD,
    storeId: owner.storeId,
  });
  return { owner, username };
}

test.describe("Client roles", () => {
  test("staff do not get the Team card on the hub", async ({
    page,
    baseURL,
  }) => {
    await asTeammate(page, baseURL!, "MEMBER");

    await page.goto("/app");
    await expect(
      page.getByRole("link", { name: /Contact support/i }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: /^Team/ })).toHaveCount(0);
    await assertNoNextJsOverlay(page);
  });

  test("staff cannot manage the team", async ({ page, baseURL }) => {
    await asTeammate(page, baseURL!, "MEMBER");

    const result = await page.evaluate(async () => {
      const response = await fetch("/api/team/users", {
        credentials: "same-origin",
      });
      return { status: response.status };
    });
    expect(result.status).toBe(403);

    await page.goto("/app/team");
    await expect(page.getByText("Forbidden")).toBeVisible();
    await assertNoNextJsOverlay(page);
  });

  test("staff keep the everyday flows: expiry and scan", async ({
    page,
    baseURL,
  }) => {
    const { owner } = await asTeammate(page, baseURL!, "MEMBER");

    await page.goto(`/app/expiry?storeId=${owner.storeId}`);
    await expect(
      page.getByRole("heading", { name: "Store Expiry List" }),
    ).toBeVisible();

    await page.goto(`/app/scan?storeId=${owner.storeId}`);
    await expect(page.getByTestId("scan-flow-ready")).toBeVisible();
    await assertNoNextJsOverlay(page);
  });

  test("a second owner can manage the team", async ({ page, baseURL }) => {
    const { owner, username } = await asTeammate(page, baseURL!, "OWNER");

    await page.goto("/app");
    await expect(page.getByRole("link", { name: /^Team/ })).toBeVisible();

    await page.goto("/app/team");
    await expect(page.getByText(username)).toBeVisible();
    await expect(page.getByText(owner.username)).toBeVisible();
    await expect(page.getByText("Forbidden")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Add User" })).toBeVisible();
    await assertNoNextJsOverlay(page);
  });

  test("regular users cannot reach the admin panel", async ({
    page,
    baseURL,
  }) => {
    const owner = await provisionBusinessOwner(baseURL!, {
      withProduct: false,
    });
    await loginWithStore(page, owner);

    await page.goto("/admin");
    await expect(page).toHaveURL(/\/app/);

    const result = await page.evaluate(async () => {
      const response = await fetch("/api/admin/clients", {
        credentials: "same-origin",
      });
      return { status: response.status };
    });
    expect(result.status).toBe(403);
  });
});

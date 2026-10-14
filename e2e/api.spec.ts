import { test, expect } from "@playwright/test";
import {
  assignUserViaApi,
  createClientViaApi,
  createProductViaApi,
  createStoreViaApi,
  registerUserOnFreshContext,
  withAdminApi,
} from "./helpers/auth";

const baseURL = "http://127.0.0.1:3100";

test.describe("API end-to-end", () => {
  test("admin and user inventory APIs", async () => {
    const username = `apiuser${Date.now()}`;
    const barcode = `API${Date.now()}`;

    await withAdminApi(baseURL, async (api) => {
      const client = await createClientViaApi(api, "API Client", 25);
      const store = await createStoreViaApi(api, client.id, "API Store");
      const user = await registerUserOnFreshContext(baseURL, username);
      await assignUserViaApi(api, user.id, client.id, [store.id]);
      const product = await createProductViaApi(api, barcode, "API Product");

      const payment = await api.post("/api/admin/payments", {
        data: {
          clientId: client.id,
          year: new Date().getFullYear(),
          month: new Date().getMonth() + 1,
          discount: 5,
        },
      });
      expect(payment.ok()).toBeTruthy();
      const paymentBody = await payment.json();
      expect(paymentBody.payment.amountPaid).toBe(20);

      const workerLogin = await api.post("/api/auth/login", {
        data: { username, password: "password123" },
      });
      expect(workerLogin.ok()).toBeTruthy();

      const inventoryCreate = await api.post("/api/inventory", {
        data: {
          storeId: store.id,
          barcode: product.barcode,
          productId: product.id,
          quantity: 3,
          expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        },
      });
      expect(inventoryCreate.status()).toBe(201);

      const inventoryList = await api.get(`/api/inventory?storeId=${store.id}`);
      expect(inventoryList.ok()).toBeTruthy();
      const listBody = await inventoryList.json();
      expect(listBody.entries).toHaveLength(1);
    });
  });
});

import test from "node:test";
import assert from "node:assert/strict";
import { lookupProductByBarcode } from "../src/lib/scan-barcode-lookup";

function mockFetch(response: {
  ok: boolean;
  status: number;
  body: unknown;
}): typeof fetch {
  return (async () =>
    ({
      ok: response.ok,
      status: response.status,
      json: async () => response.body,
    }) as Response) as typeof fetch;
}

test("lookupProductByBarcode returns found product", async () => {
  const product = {
    id: "p1",
    name: "Milk",
    imagePath: null,
    barcode: "1234567890123",
  };
  const result = await lookupProductByBarcode(
    "1234567890123",
    mockFetch({
      ok: true,
      status: 200,
      body: { status: "found", source: "local", product },
    }),
  );
  assert.equal(result.status, "found");
  if (result.status === "found") {
    assert.equal(result.product.name, "Milk");
    assert.equal(result.barcode, "1234567890123");
  }
});

test("lookupProductByBarcode returns missing without throwing", async () => {
  const result = await lookupProductByBarcode(
    "999",
    mockFetch({ ok: true, status: 200, body: { status: "missing", barcode: "999" } }),
  );
  assert.equal(result.status, "missing");
});

test("lookupProductByBarcode returns error for failed API without throwing", async () => {
  const result = await lookupProductByBarcode(
    "123",
    mockFetch({ ok: false, status: 500, body: { error: "Server error" } }),
  );
  assert.equal(result.status, "error");
  if (result.status === "error") {
    assert.equal(result.message, "Server error");
  }
});

test("lookupProductByBarcode returns network error without throwing", async () => {
  const result = await lookupProductByBarcode("123", async () => {
    throw new Error("offline");
  });
  assert.equal(result.status, "error");
  if (result.status === "error") {
    assert.equal(result.message, "NETWORK_ERROR");
  }
});

test("lookupProductByBarcode returns unauthorized", async () => {
  const result = await lookupProductByBarcode(
    "123",
    mockFetch({ ok: false, status: 401, body: {} }),
  );
  assert.equal(result.status, "unauthorized");
});

test("lookupProductByBarcode rejects empty barcode", async () => {
  const result = await lookupProductByBarcode("   ", mockFetch({ ok: true, status: 200, body: {} }));
  assert.equal(result.status, "error");
  if (result.status === "error") {
    assert.equal(result.message, "INVALID_BARCODE");
  }
});

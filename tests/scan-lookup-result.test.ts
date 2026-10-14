import test from "node:test";
import assert from "node:assert/strict";
import { applyLookupResult } from "../src/lib/scan-lookup-result";

test("applyLookupResult handles found product without throwing", () => {
  const steps: string[] = [];
  const product = {
    id: "p1",
    name: "Milk",
    imagePath: null,
    barcode: "123",
  };

  applyLookupResult(
    { status: "found", barcode: "123", product },
    {
      setMessage: () => undefined,
      setBarcode: (value) => steps.push(`barcode:${value}`),
      setProduct: () => steps.push("product"),
      goToStep: (step) => steps.push(step),
      t: (key) => key,
    },
  );

  assert.deepEqual(steps, ["barcode:123", "product", "date"]);
});

test("applyLookupResult handles missing product without throwing", () => {
  const steps: string[] = [];

  applyLookupResult(
    { status: "missing", barcode: "999" },
    {
      setMessage: () => undefined,
      setBarcode: (value) => steps.push(`barcode:${value}`),
      setProduct: () => undefined,
      goToStep: (step) => steps.push(step),
      t: (key) => key,
    },
  );

  assert.deepEqual(steps, ["barcode:999", "missing"]);
});

test("applyLookupResult handles API error without throwing", () => {
  let message = "";
  applyLookupResult(
    { status: "error", message: "LOOKUP_FAILED" },
    {
      setMessage: (value) => {
        message = value;
      },
      setBarcode: () => undefined,
      setProduct: () => undefined,
      goToStep: () => undefined,
      t: (key) => key,
    },
  );

  assert.equal(message, "errors.lookupFailed");
});

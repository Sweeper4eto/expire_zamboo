import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isLikelyInvalidBarcode,
  isLikelyNameFragment,
  isWrappedNameContinuation,
  looksLikeEan,
  mergeWrappedNameContinuations,
  repairFragmentRowAlignment,
  repairUpwardExpiryColumnShift,
  sanitizeDocumentRow,
  sanitizeDocumentRows,
} from "../src/lib/document-row-sanitize";

describe("sanitizeDocumentRow", () => {
  it("normalizes EAN-shaped barcode digits only", () => {
    const row = sanitizeDocumentRow({
      name: "Milk",
      barcode: "4006381333931",
      articul: "SKU-99",
      expiryYmd: "2026-12-01",
      quantity: 2,
    });
    assert.equal(row.barcode, "4006381333931");
    assert.equal(row.articul, "SKU-99");
  });

  it("does not move invalid barcode into articul", () => {
    const row = sanitizeDocumentRow({
      name: "Milk",
      barcode: "1234567890123",
      articul: "A-100",
      expiryYmd: "2026-12-01",
      quantity: 2,
    });
    assert.equal(row.barcode, "1234567890123");
    assert.equal(row.articul, "A-100");
  });

  it("does not promote articul to barcode", () => {
    const row = sanitizeDocumentRow({
      name: "Milk",
      barcode: null,
      articul: "4006381333931",
      expiryYmd: "2026-12-01",
      quantity: 1,
    });
    assert.equal(row.barcode, null);
    assert.equal(row.articul, "4006381333931");
  });

  it("caps absurd quantities", () => {
    const row = sanitizeDocumentRow({
      name: "Milk",
      barcode: null,
      articul: "123",
      expiryYmd: "2026-12-01",
      quantity: 99999,
    });
    assert.equal(row.quantity, 999);
  });

  it("detects likely invalid barcodes", () => {
    assert.equal(looksLikeEan("1234567890123"), true);
    assert.equal(isLikelyInvalidBarcode("1234567890123"), true);
    assert.equal(isLikelyInvalidBarcode("4006381333931"), false);
  });
});

describe("repairFragmentRowAlignment", () => {
  it("detects single-word leftovers without sku/barcode as fragments", () => {
    assert.equal(
      isLikelyNameFragment({
        name: "Праскова",
        barcode: null,
        articul: null,
        expiryYmd: "2026-08-12",
        quantity: 24,
      }),
      true,
    );
    assert.equal(
      isLikelyNameFragment({
        name: "Бъбъл чай SIMPATICO праскова 320мл",
        barcode: null,
        articul: "12345",
        expiryYmd: "2026-08-12",
        quantity: 24,
      }),
      false,
    );
  });

  it("drops a leftover above a real product and returns stolen date/qty to it", () => {
    const repaired = repairFragmentRowAlignment([
      {
        name: "Праскова",
        barcode: null,
        articul: null,
        expiryYmd: "2026-08-12",
        quantity: 24,
      },
      {
        name: "Бъбъл чай SIMPATICO праскова 320мл",
        barcode: null,
        articul: "88112",
        expiryYmd: null,
        quantity: 1,
      },
      {
        name: "Сок манго 1л",
        barcode: null,
        articul: "99001",
        expiryYmd: "2026-09-01",
        quantity: 6,
      },
    ]);

    assert.equal(repaired.length, 2);
    assert.equal(repaired[0].name, "Бъбъл чай SIMPATICO праскова 320мл");
    assert.equal(repaired[0].quantity, 24);
    assert.equal(repaired[0].expiryYmd, "2026-08-12");
    assert.equal(repaired[1].expiryYmd, "2026-09-01");
  });

  it("merges a wrapped two-line product name and keeps the Godnost on the first line", () => {
    const rows = sanitizeDocumentRows([
      {
        name: "АЕА КРАНЦХ Krekeri пълнозърнести зехтин и",
        barcode: null,
        articul: "55102",
        expiryYmd: "2027-03-15",
        quantity: 6,
      },
      {
        name: "сусам, 160г",
        barcode: null,
        articul: null,
        expiryYmd: null,
        quantity: 1,
      },
      {
        name: "Other product",
        barcode: null,
        articul: "1002",
        expiryYmd: "2027-04-01",
        quantity: 2,
      },
    ]);
    assert.equal(rows.length, 2);
    assert.equal(
      rows[0].name,
      "АЕА КРАНЦХ Krekeri пълнозърнести зехтин и сусам, 160г",
    );
    assert.equal(rows[0].expiryYmd, "2027-03-15");
    assert.equal(rows[0].quantity, 6);
    assert.equal(rows[0].articul, "55102");
    assert.equal(rows[1].name, "Other product");
  });

  it("detects lowercase wrap lines as name continuations", () => {
    assert.equal(
      isWrappedNameContinuation(
        {
          name: "АЕА КРАНЦХ Krekeri пълнозърнести зехтин и",
          barcode: null,
          articul: "1",
          expiryYmd: "2027-01-01",
          quantity: 3,
        },
        {
          name: "сусам, 160г",
          barcode: null,
          articul: null,
          expiryYmd: null,
          quantity: 1,
        },
      ),
      true,
    );
    assert.deepEqual(
      mergeWrappedNameContinuations([
        {
          name: "АЕА КРАНЦХ Krekeri пълнозърнести зехтин и",
          barcode: null,
          articul: null,
          expiryYmd: "2027-01-01",
          quantity: 3,
        },
        {
          name: "сусам, 160г",
          barcode: null,
          articul: null,
          expiryYmd: null,
          quantity: 1,
        },
      ])[0].name,
      "АЕА КРАНЦХ Krekeri пълнозърнести зехтин и сусам, 160г",
    );
  });

  it("keeps two consecutive same-name products as separate rows", () => {
    const rows = sanitizeDocumentRows([
      {
        name: "Maggi 3 Минути Пилешка крем супа с фиде, 12гр",
        barcode: null,
        articul: "900001261",
        expiryYmd: null,
        quantity: 21,
      },
      {
        name: "Maggi 3 Минути Пилешка крем супа с фиде, 12гр",
        barcode: null,
        articul: "900001261",
        expiryYmd: "2027-06-15",
        quantity: 1,
      },
    ]);
    assert.equal(rows.length, 2);
    assert.equal(rows[0].quantity, 21);
    assert.equal(rows[0].expiryYmd, null);
    assert.equal(rows[1].quantity, 1);
    assert.equal(rows[1].expiryYmd, "2027-06-15");
  });

  it("does not treat identical names as a wrapped-name continuation", () => {
    assert.equal(
      isWrappedNameContinuation(
        {
          name: "Maggi soup 12гр",
          barcode: null,
          articul: null,
          expiryYmd: null,
          quantity: 21,
        },
        {
          name: "Maggi soup 12гр",
          barcode: null,
          articul: null,
          expiryYmd: null,
          quantity: 1,
        },
      ),
      false,
    );
  });

  it("keeps a short two-word product and its date even when the next row shares Godnost", () => {
    const rows = sanitizeDocumentRows([
      {
        name: "AEA KRANCH",
        barcode: null,
        articul: null,
        expiryYmd: "2027-03-15",
        quantity: 3,
      },
      {
        name: "Other chips",
        barcode: null,
        articul: "1002",
        expiryYmd: "2027-03-15",
        quantity: 10,
      },
    ]);
    assert.equal(rows.length, 2);
    assert.equal(rows[0].name, "AEA KRANCH");
    assert.equal(rows[0].expiryYmd, "2027-03-15");
    assert.equal(rows[1].expiryYmd, "2027-03-15");
  });

  it("does not treat two-word brand names as name fragments", () => {
    assert.equal(
      isLikelyNameFragment({
        name: "AEA KRANCH",
        barcode: null,
        articul: null,
        expiryYmd: null,
        quantity: 1,
      }),
      false,
    );
  });

  it("never moves qty or expiry between neighboring real products", () => {
    const input = [
      {
        name: "Product without date on page 2",
        barcode: null,
        articul: "1001",
        expiryYmd: null,
        quantity: 1,
      },
      {
        name: "Product with its own date",
        barcode: null,
        articul: "1002",
        expiryYmd: "2026-08-12",
        quantity: 24,
      },
    ];
    const repaired = repairFragmentRowAlignment(input);
    assert.deepEqual(repaired, input);
    const sanitized = sanitizeDocumentRows(input);
    assert.equal(sanitized[0].expiryYmd, null);
    assert.equal(sanitized[1].expiryYmd, "2026-08-12");
    assert.equal(sanitized[1].quantity, 24);
  });

  it("does not disturb a real short product that has its own sku", () => {
    const input = [
      {
        name: "Мляко",
        barcode: null,
        articul: "1001",
        expiryYmd: "2026-05-01",
        quantity: 2,
      },
      {
        name: "Хляб бял",
        barcode: null,
        articul: "1002",
        expiryYmd: "2026-05-02",
        quantity: 4,
      },
    ];
    assert.deepEqual(repairFragmentRowAlignment(input), input);
  });

  it("keeps identical Godnost on neighboring rows (same batch is common)", () => {
    const rows = sanitizeDocumentRows([
      {
        name: "Product A",
        barcode: null,
        articul: "1001",
        expiryYmd: "2027-03-15",
        quantity: 3,
      },
      {
        name: "Product B",
        barcode: null,
        articul: "1002",
        expiryYmd: "2027-03-15",
        quantity: 10,
      },
    ]);
    assert.equal(rows[0].expiryYmd, "2027-03-15");
    assert.equal(rows[0].quantity, 3);
    assert.equal(rows[1].expiryYmd, "2027-03-15");
    assert.equal(rows[1].quantity, 10);
  });

  it("repairUpwardExpiryColumnShift can still fix a clear whole-column zip", () => {
    // Kept as a helper; sanitizeDocumentRows no longer applies it automatically.
    const rows = repairUpwardExpiryColumnShift([
      {
        name: "A blank Godnost",
        barcode: null,
        articul: "1",
        expiryYmd: "2027-02-02",
        quantity: 3,
      },
      {
        name: "B",
        barcode: null,
        articul: "2",
        expiryYmd: "2027-03-03",
        quantity: 10,
      },
      {
        name: "C",
        barcode: null,
        articul: "3",
        expiryYmd: "2027-04-04",
        quantity: 7,
      },
      {
        name: "D should keep 2027-04-04",
        barcode: null,
        articul: "4",
        expiryYmd: null,
        quantity: 1,
      },
    ]);
    assert.equal(rows[0].expiryYmd, null);
    assert.equal(rows[1].expiryYmd, "2027-02-02");
    assert.equal(rows[2].expiryYmd, "2027-03-03");
    assert.equal(rows[3].expiryYmd, "2027-04-04");
  });

  it("sanitizeDocumentRows does not auto-shift Godnost between rows", () => {
    const rows = sanitizeDocumentRows([
      {
        name: "Product without printed Godnost",
        barcode: null,
        articul: "1001",
        expiryYmd: "2027-03-15",
        quantity: 3,
      },
      {
        name: "Product with printed Godnost",
        barcode: null,
        articul: "1002",
        expiryYmd: null,
        quantity: 10,
      },
    ]);
    assert.equal(rows[0].expiryYmd, "2027-03-15");
    assert.equal(rows[1].expiryYmd, null);
  });

  it("does not move mid-page dates between neighbors", () => {
    const rows = sanitizeDocumentRows([
      {
        name: "Page start blank Godnost",
        barcode: null,
        articul: "0",
        expiryYmd: null,
        quantity: 1,
      },
      {
        name: "Keep my date",
        barcode: null,
        articul: "1",
        expiryYmd: "2027-01-01",
        quantity: 1,
      },
      {
        name: "Blank Godnost mid page",
        barcode: null,
        articul: "2",
        expiryYmd: null,
        quantity: 5,
      },
      {
        name: "Has own date",
        barcode: null,
        articul: "3",
        expiryYmd: "2027-06-01",
        quantity: 2,
      },
    ]);
    assert.equal(rows[0].expiryYmd, null);
    assert.equal(rows[1].expiryYmd, "2027-01-01");
    assert.equal(rows[2].expiryYmd, null);
    assert.equal(rows[3].expiryYmd, "2027-06-01");
  });

  it("does not strip a complete first product's date when only the last line is blank", () => {
    const rows = sanitizeDocumentRows([
      {
        name: "АЕА КРАНЦХ Krekeri пълнозърнести зехтин и сусам, 160г",
        barcode: null,
        articul: "55102",
        expiryYmd: "2027-03-15",
        quantity: 6,
      },
      {
        name: "Other product",
        barcode: null,
        articul: "1002",
        expiryYmd: "2027-04-01",
        quantity: 2,
      },
      {
        name: "x",
        barcode: null,
        articul: null,
        expiryYmd: null,
        quantity: 1,
      },
    ]);
    assert.equal(rows[0].expiryYmd, "2027-03-15");
    assert.equal(rows[0].name.includes("АЕА КРАНЦХ"), true);
    assert.equal(rows[1].expiryYmd, "2027-04-01");
  });

  it("does not shift when the last row correctly has a date", () => {
    const rows = sanitizeDocumentRows([
      {
        name: "A",
        barcode: null,
        articul: "1",
        expiryYmd: "2027-01-01",
        quantity: 1,
      },
      {
        name: "B",
        barcode: null,
        articul: "2",
        expiryYmd: "2027-02-02",
        quantity: 2,
      },
      {
        name: "C",
        barcode: null,
        articul: "3",
        expiryYmd: "2027-03-03",
        quantity: 3,
      },
    ]);
    assert.equal(rows[0].expiryYmd, "2027-01-01");
    assert.equal(rows[1].expiryYmd, "2027-02-02");
    assert.equal(rows[2].expiryYmd, "2027-03-03");
  });

  it("sanitizeDocumentRows drops orphan single-word crumbs with no date", () => {
    const rows = sanitizeDocumentRows([
      {
        name: "Праскова",
        barcode: null,
        articul: null,
        expiryYmd: null,
        quantity: 1,
      },
      {
        name: "Бъбъл чай SIMPATICO праскова 320мл",
        barcode: null,
        articul: "88112",
        expiryYmd: "2026-08-12",
        quantity: 24,
      },
    ]);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].name, "Бъбъл чай SIMPATICO праскова 320мл");
  });
});

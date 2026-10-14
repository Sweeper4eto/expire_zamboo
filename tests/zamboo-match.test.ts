import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { applyZambooAiPicks, parseZambooAiMatches } from "../src/lib/zamboo/ai-match";
import {
  buildZambooCatalogIndex,
  invalidateZambooCatalogCache,
  setZambooCatalogForTests,
  type ZambooCatalogItem,
} from "../src/lib/zamboo/catalog";
import {
  ZAMBOO_FINAL_PICK_MAX,
  exactZambooIdentityMatch,
  matchZambooRows,
  retrieveZambooCandidates,
} from "../src/lib/zamboo/match";
import {
  extractPack,
  extractSizes,
  foldZambooToken,
  normalizeZambooName,
  zambooNameTokens,
} from "../src/lib/zamboo/names";
import { filterCatalogByQuery, normalizeZambooQuery } from "../src/lib/zamboo/query";

function item(partial: {
  gId: string;
  name: string;
  code: string;
  barcode?: string | null;
  altName?: string;
}): ZambooCatalogItem {
  const altName = partial.altName ?? "";
  const nameForTokens =
    altName && altName !== partial.barcode
      ? `${partial.name} ${altName}`
      : partial.name;
  const tokens = zambooNameTokens(nameForTokens);
  return {
    gId: partial.gId,
    name: partial.name,
    altName,
    nameNormalized: normalizeZambooName(partial.name),
    code: partial.code,
    barcode: partial.barcode ?? null,
    tokens,
    foldedTokens: tokens.map((token) => foldZambooToken(token)),
    sizes: extractSizes(nameForTokens),
    pack: extractPack(nameForTokens),
  };
}

function catalog(items: ZambooCatalogItem[]) {
  return buildZambooCatalogIndex(items);
}

const colaItems = [
  item({ gId: "c-250", name: "кока кола 0.250мл", code: "2240" }),
  item({ gId: "c-2l", name: "Кока Кола 2л", code: "9926" }),
  item({ gId: "c-1l", name: "Кока Кола 1.л", code: "9927" }),
  item({ gId: "c-500", name: "Кока Кола 500мл бут.", code: "9928" }),
  item({ gId: "c-zero-2l", name: "Кока Кола Зиро 2л", code: "9959" }),
  item({ gId: "c-zero-500", name: "Кока Кола Зиро 500мл", code: "9960" }),
  item({ gId: "c-330", name: "Кока Кола 330мл КЕН", code: "9974" }),
];

describe("zamboo retrieve", () => {
  it("returns every Coca-Cola SKU, not a top-12 slice", () => {
    const index = catalog(colaItems);
    const pool = retrieveZambooCandidates(
      { name: "Coca-Cola bottle", barcode: null, articul: null },
      index,
    );
    const ids = pool.map((row) => row.gId);
    assert.ok(ids.includes("c-500"));
    assert.equal(pool.some((row) => row.gId === "c-330"), false);
    assert.ok(pool.length >= 4);
  });

  it("keeps thousands of similar local SKUs in the pool", () => {
    const cheeses = Array.from({ length: 800 }, (_, index) =>
      item({
        gId: `cheese-${index}`,
        name: `СИРЕНЕ КРАВЕ ${index} 200г`,
        code: String(1000 + index),
      }),
    );
    const target = item({
      gId: "cheese-target",
      name: "СИРЕНЕ КРАВЕ 400г",
      code: "9999",
    });
    const index = catalog([...cheeses, target]);
    const query = normalizeZambooQuery({
      include: ["sirene", "krave"],
      size: "400g",
    });
    const hits = filterCatalogByQuery(index, query);
    assert.ok(cheeses.length > ZAMBOO_FINAL_PICK_MAX);
    assert.equal(hits.some((row) => row.gId === "cheese-target"), true);
    assert.ok(hits.length < 20);
  });
});

describe("zamboo identity", () => {
  it("matches by store SKU / code without AI", () => {
    const index = catalog(colaItems);
    const hit = exactZambooIdentityMatch(
      { name: "something else", barcode: null, articul: "9928" },
      index,
    );
    assert.equal(hit?.gId, "c-500");
    assert.equal(hit?.source, "code");
  });

  it("matches by barcode stored from Zamboo altName", () => {
    const hipp = item({
      gId: "hipp",
      name: "ХИПП 1 БИО КОМБИОТИК",
      code: "2001187",
      barcode: "9062300134268",
      altName: "9062300134268",
    });
    const index = catalog([hipp, ...colaItems]);
    const hit = exactZambooIdentityMatch(
      { name: "Hipp milk", barcode: "9062300134268", articul: null },
      index,
    );
    assert.equal(hit?.gId, "hipp");
    assert.equal(hit?.source, "barcode");
  });
});

describe("zamboo AI cross-check", () => {
  it("parses model JSON and ignores gIds that were not candidates", () => {
    const picks = parseZambooAiMatches(
      `{"matches":[{"i":0,"gId":"c-500","reason":"bottle = бут 500ml"},{"i":1,"gId":"missing","reason":"no"}]}`,
    );
    assert.equal(picks[0]?.gId, "c-500");
    const applied = applyZambooAiPicks([colaItems, colaItems], picks);
    assert.equal(applied.get(0)?.gId, "c-500");
    assert.equal(applied.has(1), false);
  });

  it("lets AI pick 500ml бут after filtering the local catalog", async () => {
    setZambooCatalogForTests(colaItems);
    const [hit] = await matchZambooRows(
      [{ name: "Coca-Cola bottle", barcode: null, articul: null }],
      {
        completeJson: async ({ system }) => {
          if (system.includes("search queries")) {
            return JSON.stringify({
              queries: [
                {
                  i: 0,
                  include: ["koka", "kola"],
                  exclude: ["ziro", "zero"],
                  size: null,
                  pack: "bottle",
                },
              ],
            });
          }
          return JSON.stringify({
            matches: [
              { i: 0, gId: "c-500", reason: "bottle maps to бут, default 500ml" },
            ],
          });
        },
      },
    );
    assert.equal(hit?.gId, "c-500");
    assert.equal(hit?.source, "ai");
    assert.equal(hit?.name, "Кока Кола 500мл бут.");
  });

  it("lets AI pick Zero only when the scan says Zero", async () => {
    setZambooCatalogForTests(colaItems);
    const [hit] = await matchZambooRows(
      [{ name: "Coca-Cola Zero 500ml", barcode: null, articul: null }],
      {
        completeJson: async ({ system }) => {
          if (system.includes("search queries")) {
            return JSON.stringify({
              queries: [
                {
                  i: 0,
                  include: ["koka", "kola"],
                  exclude: [],
                  size: "500ml",
                  pack: null,
                },
              ],
            });
          }
          return JSON.stringify({
            matches: [{ i: 0, gId: "c-zero-500", reason: "zero + 500ml" }],
          });
        },
      },
    );
    assert.equal(hit?.gId, "c-zero-500");
    assert.equal(hit?.source, "ai");
  });
});

describe("zamboo match cleanup", () => {
  it("drops the in-memory catalog stub", () => {
    invalidateZambooCatalogCache();
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseZambooAiMatches, parseZambooAiQueries } from "../src/lib/zamboo/ai-match";

describe("parseZambooAiMatches", () => {
  it("reads a JSON object even with extra text around it", () => {
    const picks = parseZambooAiMatches(
      'sure\n{"matches":[{"i":0,"gId":"abc","reason":"same brand"}]}\n',
    );
    assert.deepEqual(picks, [
      { i: 0, gId: "abc", reason: "same brand" },
    ]);
  });

  it("treats empty gId as no match", () => {
    const picks = parseZambooAiMatches(
      '{"matches":[{"i":2,"gId":null,"reason":"unknown product"}]}',
    );
    assert.equal(picks[0]?.i, 2);
    assert.equal(picks[0]?.gId, null);
  });
});

describe("parseZambooAiQueries", () => {
  it("reads include/size/pack filters for a large catalog search", () => {
    const queries = parseZambooAiQueries(
      '{"queries":[{"i":0,"include":["sirene","krave"],"exclude":[],"size":"400g","pack":null}]}',
    );
    assert.equal(queries[0]?.include.includes("sirene"), true);
    assert.equal(queries[0]?.size, "400g");
  });
});

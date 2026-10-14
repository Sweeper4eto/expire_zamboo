import test from "node:test";
import assert from "node:assert/strict";
import {
  NO_PICTURE_ART_ID,
  NO_PICTURE_PLACEHOLDER_STYLE,
} from "../src/components/no-picture-placeholder";

test("no picture placeholder uses mini market scene with mint glow", () => {
  assert.equal(NO_PICTURE_ART_ID, "mini-market-scene");
  assert.equal(NO_PICTURE_PLACEHOLDER_STYLE, "mint-glow");
});

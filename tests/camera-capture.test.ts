import test from "node:test";
import assert from "node:assert/strict";
import {
  prefersNativeCameraCapture,
  resolveUseNativeCapture,
} from "../src/components/camera-capture";

test("prefersNativeCameraCapture is always off (avoid iOS re-prompts)", () => {
  assert.equal(prefersNativeCameraCapture(), false);
});

test("resolveUseNativeCapture never opens native picker", () => {
  assert.equal(resolveUseNativeCapture(false, false, true), false);
  assert.equal(resolveUseNativeCapture(false, true, true), false);
  assert.equal(resolveUseNativeCapture(true, false, true), false);
  assert.equal(resolveUseNativeCapture(false, false, false), false);
});

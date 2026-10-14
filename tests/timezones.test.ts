import test from "node:test";
import assert from "node:assert/strict";
import {
  buildTimezoneOptions,
  resolveTimezoneForForm,
} from "../src/lib/timezones";

test("resolveTimezoneForForm uses detected until prefs are customized", () => {
  assert.equal(
    resolveTimezoneForForm(false, "Europe/Sofia", "Europe/Berlin"),
    "Europe/Berlin",
  );
  assert.equal(
    resolveTimezoneForForm(true, "Europe/London", "Europe/Berlin"),
    "Europe/London",
  );
});

test("buildTimezoneOptions includes detected and current with auto label", () => {
  const options = buildTimezoneOptions(
    "Europe/Berlin",
    "America/New_York",
    (zone, isDetected) => (isDetected ? `${zone} · auto` : zone),
  );
  const berlin = options.find((option) => option.value === "Europe/Berlin");
  const nyc = options.find((option) => option.value === "America/New_York");
  assert.ok(berlin);
  assert.equal(berlin.label, "Europe/Berlin · auto");
  assert.ok(nyc);
  assert.equal(nyc.label, "America/New_York");
});

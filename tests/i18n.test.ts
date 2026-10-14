import test from "node:test";
import assert from "node:assert/strict";
import { t, monthName, apiT } from "../src/i18n";

test("t resolves nested keys with interpolation", () => {
  assert.equal(t("app.greeting", { username: "alice" }), "Hello,\nalice");
  assert.equal(t("admin.storesCount", { stores: 2, users: 3 }), "2 locations · 3 users");
});

test("t resolves Bulgarian strings", () => {
  assert.equal(t("app.greeting", { username: "иван" }, "bg"), "Здравей,\nиван");
  assert.equal(t("auth.login", undefined, "bg"), "Вход");
});

test("t falls back to key for unknown paths", () => {
  assert.equal(t("missing.key" as "common.appName"), "missing.key");
});

test("monthName returns English month names", () => {
  assert.equal(monthName(1), "January");
  assert.equal(monthName(12), "December");
});

test("monthName returns Bulgarian month names", () => {
  assert.equal(monthName(1, "bg"), "януари");
  assert.equal(monthName(12, "bg"), "декември");
});

test("apiT uses Accept-Language when locale is registered", () => {
  const request = new Request("http://localhost", {
    headers: { "accept-language": "en-US,en;q=0.9" },
  });
  assert.equal(apiT(request, "auth.login"), "Log in");
});

test("apiT uses locale cookie for mobile client", () => {
  const request = new Request("http://localhost", {
    headers: { cookie: "magazin-locale=bg" },
  });
  assert.equal(apiT(request, "auth.login"), "Вход");
});

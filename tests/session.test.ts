import test from "node:test";
import assert from "node:assert/strict";
import { setupTestEnv } from "./helpers/db";

setupTestEnv();

test("createSessionToken and verifySessionToken round-trip", async () => {
  const { createSessionToken, verifySessionToken } = await import("../src/lib/session");
  const token = await createSessionToken({
    userId: "user-1",
    username: "alice",
    role: "USER",
    clientId: "client-1",
  });

  const payload = await verifySessionToken(token);
  assert.deepEqual(payload, {
    userId: "user-1",
    username: "alice",
    role: "USER",
    clientId: "client-1",
    mustChangePassword: false,
  });
});

test("verifySessionToken returns null for invalid token", async () => {
  const { verifySessionToken } = await import("../src/lib/session");
  assert.equal(await verifySessionToken("not-a-valid-token"), null);
});

test("verifySessionToken returns null for tampered token", async () => {
  const { createSessionToken, verifySessionToken } = await import("../src/lib/session");
  const token = await createSessionToken({
    userId: "user-1",
    username: "alice",
    role: "ADMIN",
    clientId: null,
  });
  assert.equal(await verifySessionToken(`${token}x`), null);
});

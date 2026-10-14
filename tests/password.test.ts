import test from "node:test";
import assert from "node:assert/strict";
import { hashPassword, verifyPassword } from "../src/lib/password";

test("hashPassword and verifyPassword round-trip", async () => {
  const hash = await hashPassword("secret-pass");
  assert.notEqual(hash, "secret-pass");
  assert.equal(await verifyPassword("secret-pass", hash), true);
  assert.equal(await verifyPassword("wrong-pass", hash), false);
});

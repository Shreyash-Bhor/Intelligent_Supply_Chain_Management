import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { verifyGuestRateLimitSignature } from "../src/services/assistantSecurity.ts";

test("accepts only a correctly signed guest rate-limit identity", () => {
  const key = "a".repeat(64);
  const secret = "test-secret";
  const signature = createHmac("sha256", secret).update(`rate-limit:${key}`).digest("base64url");
  assert.equal(verifyGuestRateLimitSignature(key, signature, secret), true);
  assert.equal(verifyGuestRateLimitSignature(key, signature, "wrong-secret"), false);
  assert.equal(verifyGuestRateLimitSignature("raw-ip-address", signature, secret), false);
});

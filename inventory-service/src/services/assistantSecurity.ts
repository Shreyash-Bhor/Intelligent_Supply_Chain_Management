import { createHmac, timingSafeEqual } from "node:crypto";

export function verifyGuestRateLimitSignature(clientKey: string, signature: string, secret: string) {
  if (!/^[a-f0-9]{64}$/.test(clientKey) || !signature || !secret) return false;
  const expected = createHmac("sha256", secret).update(`rate-limit:${clientKey}`).digest();
  const supplied = Buffer.from(signature, "base64url");
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

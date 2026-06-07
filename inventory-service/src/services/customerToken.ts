import { createHmac, timingSafeEqual } from "node:crypto";

export type CustomerTokenPayload = {
  sub: string;
  email: string;
  exp: number;
};

const encode = (value: string) => Buffer.from(value).toString("base64url");

function secret() {
  const value = process.env.AUTH_TOKEN_SECRET;
  if (!value) throw new Error("AUTH_TOKEN_SECRET is not configured");
  return value;
}

function signature(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function createCustomerToken(userId: string, email: string) {
  const payload = encode(
    JSON.stringify({
      sub: userId,
      email,
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24,
    } satisfies CustomerTokenPayload),
  );
  return `${payload}.${signature(payload)}`;
}

export function verifyCustomerToken(
  token: string,
): CustomerTokenPayload | null {
  const [payload, providedSignature] = token.split(".");
  if (!payload || !providedSignature) return null;

  const expectedSignature = signature(payload);
  const provided = Buffer.from(providedSignature);
  const expected = Buffer.from(expectedSignature);
  if (
    provided.length !== expected.length ||
    !timingSafeEqual(provided, expected)
  )
    return null;

  try {
    const parsed = JSON.parse(
      Buffer.from(payload, "base64url").toString(),
    ) as CustomerTokenPayload;
    if (
      !parsed.sub ||
      !parsed.email ||
      parsed.exp <= Math.floor(Date.now() / 1000)
    )
      return null;
    return parsed;
  } catch {
    return null;
  }
}

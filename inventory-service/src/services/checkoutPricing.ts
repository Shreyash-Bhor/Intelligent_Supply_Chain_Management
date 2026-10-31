import { createHmac, timingSafeEqual } from "node:crypto";
import prisma from "../lib/prisma";
import { getCurrentProductPrices } from "./pricingService";
import { calculateAmounts, fromMinor, toMinor } from "./money";

const secret = () => {
  if (!process.env.AUTH_TOKEN_SECRET) throw new Error("AUTH_TOKEN_SECRET is not configured");
  return process.env.AUTH_TOKEN_SECRET;
};

export async function createQuote(userId: string, addressId?: string) {
  // These reads are independent and both remain scoped to the authenticated customer.
  const [storedAddress, cart] = await Promise.all([
    prisma.address.findFirst({ where: addressId ? { id: addressId, userId } : { userId, isDefault: true } }),
    prisma.cart.findUnique({ where: { userId }, include: { items: true } }),
  ]);
  if (!storedAddress) throw Object.assign(new Error(addressId ? "Shipping address not found" : "Choose or save a default shipping address before checkout"), { statusCode: addressId ? 404 : 422 });
  const address = { id: storedAddress.id, name: storedAddress.name, phone: storedAddress.phone, address1: storedAddress.address1, address2: storedAddress.address2, city: storedAddress.city, region: storedAddress.region, postalCode: storedAddress.postalCode, country: storedAddress.country, isDefault: storedAddress.isDefault };
  if (!cart?.items.length) throw Object.assign(new Error("Your cart is empty"), { statusCode: 422 });
  const ids = cart.items.map((item) => item.productId);
  const [products, prices, stock] = await Promise.all([
    prisma.product.findMany({ where: { id: { in: ids }, isActive: true }, select: { id: true, name: true, sku: true, imageUrl: true } }),
    getCurrentProductPrices(ids),
    prisma.inventory.groupBy({ by: ["productId"], where: { productId: { in: ids }, warehouse: { isActive: true } }, _sum: { availableQty: true } }),
  ]);
  const productMap = new Map(products.map((p) => [p.id, p]));
  const stockMap = new Map(stock.map((s) => [s.productId, s._sum.availableQty ?? 0]));
  const lines = cart.items.map((item) => {
    const product = productMap.get(item.productId);
    const price = prices.get(item.productId);
    if (!product || !price) throw Object.assign(new Error("A cart product is unavailable or no longer priced"), { statusCode: 409 });
    const availableQty = stockMap.get(item.productId) ?? 0;
    if (item.quantity > availableQty) throw Object.assign(new Error(`${product.name} has only ${availableQty} available`), { statusCode: 409 });
    return { productId: item.productId, name: product.name, sku: product.sku, imageUrl: product.imageUrl, quantity: item.quantity, unitPrice: price.price, currency: price.currency, lineTotalMinor: toMinor(price.price) * item.quantity, availableQty };
  });
  const currencies = new Set(lines.map((line) => line.currency));
  if (currencies.size !== 1) throw Object.assign(new Error("Cart items must use one currency"), { statusCode: 422 });
  const subtotalMinor = lines.reduce((sum, line) => sum + line.lineTotalMinor, 0);
  // This payment-free checkout records item prices only. Shipping and tax remain
  // explicitly uncalculated until an approved market policy is configured.
  const amounts = calculateAmounts(subtotalMinor, 0, 0);
  const expiresAt = Date.now() + 3 * 60 * 1000;
  const digest = JSON.stringify({ userId, addressId, address: { name: address.name, phone: address.phone, address1: address.address1, address2: address.address2, city: address.city, region: address.region, postalCode: address.postalCode, country: address.country }, cartId: cart.id, lines: lines.map(({ productId, name, sku, quantity, unitPrice, currency }) => ({ productId, name, sku, quantity, unitPrice, currency })) });
  const payload = Buffer.from(JSON.stringify({ expiresAt, digest })).toString("base64url");
  const signature = createHmac("sha256", secret()).update(payload).digest("base64url");
  return { address, lines, currency: lines[0]!.currency, subtotal: fromMinor(amounts.subtotalMinor), shippingTotal: null, taxTotal: null, total: fromMinor(amounts.totalMinor), quoteToken: `${payload}.${signature}`, expiresAt: new Date(expiresAt).toISOString(), snapshot: { cartId: cart.id, ...amounts, digest } };
}

export function verifyQuoteToken(token: string, currentDigestData: unknown) {
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return false;
  const expected = createHmac("sha256", secret()).update(payload).digest();
  const actual = Buffer.from(signature, "base64url");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return false;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString()) as { expiresAt: number; digest: string };
    return parsed.expiresAt > Date.now() && parsed.digest === currentDigestData;
  } catch { return false; }
}

export function getSignedQuoteDigest(token: string): string | null {
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expected = createHmac("sha256", secret()).update(payload).digest();
  const actual = Buffer.from(signature, "base64url");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString()) as { digest: string };
    return typeof parsed.digest === "string" ? parsed.digest : null;
  } catch { return null; }
}

export { toMinor };

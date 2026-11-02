import { createHmac, timingSafeEqual } from "node:crypto";
import prisma from "../lib/prisma";
import { getCurrentProductPrices } from "./pricingService";
import { calculateAmounts, fromMinor, toMinor } from "./money";

const secret = () => {
  if (!process.env.AUTH_TOKEN_SECRET) throw new Error("AUTH_TOKEN_SECRET is not configured");
  return process.env.AUTH_TOKEN_SECRET;
};

export async function createQuote(userId: string, addressId?: string) {
  const quoteStartedAt = Date.now();
  console.info(JSON.stringify({ event: "checkout_quote_started", service: "inventory", hasAddressId: Boolean(addressId) }));
  // These reads are independent and both remain scoped to the authenticated customer.
  const [storedAddress, cart] = await Promise.all([
    prisma.address.findFirst({ where: addressId ? { id: addressId, userId } : { userId, isDefault: true } }),
    prisma.cart.findUnique({ where: { userId }, include: { items: true } }),
  ]);
  if (!storedAddress) {
    const message = addressId ? "Shipping address not found" : "Choose or save a default shipping address before checkout";
    console.warn(JSON.stringify({ event: "checkout_quote_failed", service: "inventory", stage: "address_lookup", statusCode: addressId ? 404 : 422, message }));
    throw Object.assign(new Error(message), { statusCode: addressId ? 404 : 422 });
  }
  const address = { id: storedAddress.id, name: storedAddress.name, phone: storedAddress.phone, address1: storedAddress.address1, address2: storedAddress.address2, city: storedAddress.city, region: storedAddress.region, postalCode: storedAddress.postalCode, country: storedAddress.country, isDefault: storedAddress.isDefault };
  if (!cart?.items.length) {
    console.warn(JSON.stringify({ event: "checkout_quote_failed", service: "inventory", stage: "cart_lookup", statusCode: 422, message: "Your cart is empty" }));
    throw Object.assign(new Error("Your cart is empty"), { statusCode: 422 });
  }
  const ids = cart.items.map((item) => item.productId);
  console.info(JSON.stringify({ event: "checkout_quote_cart_loaded", service: "inventory", itemCount: ids.length }));
  const [products, prices, stock] = await Promise.all([
    prisma.product.findMany({ where: { id: { in: ids }, isActive: true }, select: { id: true, name: true, sku: true, category: true, imageUrl: true } }),
    getCurrentProductPrices(ids),
    prisma.inventory.groupBy({ by: ["productId"], where: { productId: { in: ids }, warehouse: { isActive: true } }, _sum: { availableQty: true } }),
  ]);
  console.info(JSON.stringify({ event: "checkout_quote_dependencies_loaded", service: "inventory", requestedProducts: ids.length, activeProducts: products.length, pricedProducts: prices.size, stockedProducts: stock.length }));
  const productMap = new Map(products.map((p) => [p.id, p]));
  const stockMap = new Map(stock.map((s) => [s.productId, s._sum.availableQty ?? 0]));
  const lines = cart.items.map((item) => {
    const product = productMap.get(item.productId);
    const price = prices.get(item.productId);
    if (!product || !price) {
      const message = "A cart product is unavailable or no longer priced";
      console.warn(JSON.stringify({ event: "checkout_quote_failed", service: "inventory", stage: "product_validation", productId: item.productId, productActive: Boolean(product), priceAvailable: Boolean(price), statusCode: 409, message }));
      throw Object.assign(new Error(message), { statusCode: 409 });
    }
    const availableQty = stockMap.get(item.productId) ?? 0;
    if (item.quantity > availableQty) {
      const message = `${product.name} has only ${availableQty} available`;
      console.warn(JSON.stringify({ event: "checkout_quote_failed", service: "inventory", stage: "stock_validation", productId: item.productId, requestedQty: item.quantity, availableQty, statusCode: 409, message }));
      throw Object.assign(new Error(message), { statusCode: 409 });
    }
    return { productId: item.productId, name: product.name, sku: product.sku, category: product.category, imageUrl: product.imageUrl, quantity: item.quantity, unitPrice: price.price, currency: price.currency, lineTotalMinor: toMinor(price.price) * item.quantity, availableQty };
  });
  const currencies = new Set(lines.map((line) => line.currency));
  if (currencies.size !== 1) {
    const message = "Cart items must use one currency";
    console.warn(JSON.stringify({ event: "checkout_quote_failed", service: "inventory", stage: "currency_validation", currencyCount: currencies.size, statusCode: 422, message }));
    throw Object.assign(new Error(message), { statusCode: 422 });
  }
  const subtotalMinor = lines.reduce((sum, line) => sum + line.lineTotalMinor, 0);
  // This payment-free checkout records item prices only. Shipping and tax remain
  // explicitly uncalculated until an approved market policy is configured.
  const amounts = calculateAmounts(subtotalMinor, 0, 0);
  const expiresAt = Date.now() + 3 * 60 * 1000;
  // Bind the quote to the resolved address, regardless of whether the caller
  // selected it explicitly or relied on the customer's default address.
  const digest = JSON.stringify({ userId, addressId: address.id, address: { name: address.name, phone: address.phone, address1: address.address1, address2: address.address2, city: address.city, region: address.region, postalCode: address.postalCode, country: address.country }, cartId: cart.id, lines: lines.map(({ productId, name, sku, quantity, unitPrice, currency }) => ({ productId, name, sku, quantity, unitPrice, currency })) });
  const payload = Buffer.from(JSON.stringify({ expiresAt, digest })).toString("base64url");
  const signature = createHmac("sha256", secret()).update(payload).digest("base64url");
  console.info(JSON.stringify({ event: "checkout_quote_complete", service: "inventory", itemCount: lines.length, durationMs: Date.now() - quoteStartedAt }));
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

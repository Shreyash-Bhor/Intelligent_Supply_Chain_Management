import { Request, Response } from "express";
import prisma from "../lib/prisma";
import { checkoutQuoteSchema, checkoutSchema } from "../schemas/checkoutSchema";
import { createQuote, getSignedQuoteDigest, verifyQuoteToken } from "../services/checkoutPricing";
import { asyncHandler } from "../utils/asyncHandler";
import { createHmac, timingSafeEqual } from "node:crypto";
import { invalidateCache } from "../lib/cache";

function validChatConfirmation(value: string | undefined, userId: string, quoteToken: string) {
  if (!value || !process.env.AUTH_TOKEN_SECRET) return false;
  const [payload, signature] = value.split(".");
  if (!payload || !signature) return false;
  const expected = createHmac("sha256", process.env.AUTH_TOKEN_SECRET).update(payload).digest();
  const actual = Buffer.from(signature, "base64url");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return false;
  try {
    const claim = JSON.parse(Buffer.from(payload, "base64url").toString()) as { userId: string; quoteHash: string; expiresAt: number; purpose: string };
    const quoteHash = createHmac("sha256", "quote").update(quoteToken).digest("hex");
    return claim.purpose === "chat-checkout-confirmation" && claim.userId === userId && claim.quoteHash === quoteHash && claim.expiresAt > Date.now();
  } catch { return false; }
}

export function issueCheckoutConfirmation(userId: string, quoteToken: string) {
  if (!process.env.AUTH_TOKEN_SECRET) throw new Error("Checkout confirmation is unavailable.");
  const quoteHash = createHmac("sha256", "quote").update(quoteToken).digest("hex");
  const payload = Buffer.from(JSON.stringify({ purpose: "chat-checkout-confirmation", userId, quoteHash, expiresAt: Date.now() + 90_000 })).toString("base64url");
  const signature = createHmac("sha256", process.env.AUTH_TOKEN_SECRET).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export const confirmCheckout = asyncHandler(async (req: Request, res: Response) => {
  const { addressId, quoteToken } = checkoutSchema.parse(req.body);
  const userId = res.locals.customer.sub as string;
  if (req.body.confirmation !== "I confirm this order") return res.status(400).json({ status: "error", message: "Explicit confirmation is required." });
  const quote = await createQuote(userId, addressId);
  if (!verifyQuoteToken(quoteToken, quote.snapshot.digest)) return res.status(409).json({ status: "error", message: "Checkout quote expired or changed. Review the updated quote." });
  return res.status(200).json({ status: "success", data: { confirmationProof: issueCheckoutConfirmation(userId, quoteToken) } });
});

export const getCheckoutQuote = asyncHandler(async (req: Request, res: Response) => {
  const { addressId } = checkoutQuoteSchema.parse(req.body);
  const quote = await createQuote(res.locals.customer.sub as string, addressId);
  const { digest: _digest, ...snapshot } = quote.snapshot;
  return res.status(200).json({ status: "success", data: { lines: quote.lines.map(({ lineTotalMinor, ...line }) => ({ ...line, lineTotal: (lineTotalMinor / 100).toFixed(2) })), currency: quote.currency, subtotal: quote.subtotal, shippingTotal: quote.shippingTotal, taxTotal: quote.taxTotal, total: quote.total, expiresAt: quote.expiresAt, quoteToken: quote.quoteToken, address: quote.address, calculation: { shippingAndTax: "not_configured" } } });
});

export const createCartOrder = asyncHandler(async (req: Request, res: Response) => {
  const userId = res.locals.customer.sub as string;
  const { addressId, quoteToken } = checkoutSchema.parse(req.body);
  const idempotencyKey = req.header("Idempotency-Key");
  if (!idempotencyKey || idempotencyKey.length < 16 || idempotencyKey.length > 128) {
    return res.status(400).json({ status: "error", message: "A valid Idempotency-Key header is required" });
  }
  const orderInclude = {
    product: { select: { id: true, name: true, sku: true, imageUrl: true } },
    items: { include: { product: { select: { id: true, name: true, sku: true, imageUrl: true } } } },
    shipments: true,
  };
  const signedDigest = getSignedQuoteDigest(quoteToken);
  if (!signedDigest) return res.status(409).json({ status: "error", message: "Checkout quote is invalid. Prepare a new quote." });
  const prior = await prisma.order.findFirst({ where: { userId, idempotencyKey }, include: orderInclude });
  if (prior) {
    if (prior.checkoutDigest !== signedDigest) return res.status(409).json({ status: "error", message: "Idempotency key was already used for a different checkout." });
    return res.status(200).json({ status: "success", data: prior, idempotentReplay: true });
  }

  if (!validChatConfirmation(req.header("X-Chat-Confirmation"), userId, quoteToken)) {
    return res.status(403).json({ status: "error", message: "Explicit confirmation for this checkout is required." });
  }

  const quote = await createQuote(userId, addressId);
  if (!verifyQuoteToken(quoteToken, quote.snapshot.digest)) {
    return res.status(409).json({ status: "error", message: "Checkout quote expired or changed. Review the updated quote before submitting." });
  }
  const [first, ...other] = quote.lines;
  if (!first) return res.status(422).json({ status: "error", message: "Your cart is empty" });
  try {
    const order = await prisma.$transaction(async (tx: any) => {
      // Read active stock once for every quoted product. Allocation writes remain
      // conditional and transactional so concurrent checkouts cannot oversell.
      const inventoryRows = await tx.inventory.findMany({
        where: { productId: { in: quote.lines.map((line) => line.productId) }, warehouse: { isActive: true } },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      });
      const inventoryByProduct = new Map<string, typeof inventoryRows>();
      for (const row of inventoryRows) {
        const rows = inventoryByProduct.get(row.productId) ?? [];
        rows.push(row);
        inventoryByProduct.set(row.productId, rows);
      }
      const created = await tx.order.create({
        data: {
          userId, idempotencyKey, checkoutDigest: signedDigest, productId: first.productId, quantity: first.quantity, allocatedQty: first.quantity, shortageQty: 0,
          unitPrice: first.unitPrice, totalPrice: quote.total, currency: quote.currency, status: "CONFIRMED", paymentStatus: "NOT_STARTED",
          subtotal: quote.subtotal, shippingTotal: null, taxTotal: null,
          shippingName: quote.address.name, shippingPhone: quote.address.phone, shippingAddress1: quote.address.address1,
          shippingAddress2: quote.address.address2, shippingCity: quote.address.city, shippingRegion: quote.address.region,
          shippingPostalCode: quote.address.postalCode, shippingCountry: quote.address.country,
          items: { create: quote.lines.map((line) => ({ productId: line.productId, quantity: line.quantity, unitPrice: line.unitPrice, totalPrice: (line.lineTotalMinor / 100).toFixed(2), allocatedQty: line.quantity })) },
        },
      });
      for (const line of [first, ...other]) {
        let remaining = line.quantity;
        for (const row of inventoryByProduct.get(line.productId) ?? []) {
          if (remaining <= 0) break;
          const allocate = Math.min(remaining, row.availableQty);
          if (allocate <= 0) continue;
          const updated = await tx.inventory.updateMany({ where: { id: row.id, availableQty: { gte: allocate } }, data: { availableQty: { decrement: allocate }, reservedQty: { increment: allocate } } });
          if (updated.count !== 1) throw Object.assign(new Error("Stock changed during checkout. Review the cart and retry."), { statusCode: 409 });
          await tx.orderAllocation.create({ data: { orderId: created.id, inventoryId: row.id, quantity: allocate } });
          remaining -= allocate;
        }
        if (remaining > 0) throw Object.assign(new Error("Stock changed during checkout. Review the cart and retry."), { statusCode: 409 });
      }
      await tx.cartItem.deleteMany({ where: { cartId: quote.snapshot.cartId } });
      return tx.order.findUnique({ where: { id: created.id }, include: { ...orderInclude } });
    }, { isolationLevel: "Serializable" });
    await invalidateCache("inventory", "catalog", "dashboard", "warehouses");
    return res.status(201).json({ status: "success", message: "Order placed. Inventory has been reserved; no payment was collected.", data: order });
  } catch (error) {
    if ((error as { code?: string }).code === "P2034") {
      return res.status(409).json({ status: "error", message: "Inventory changed during checkout. Review your cart and retry." });
    }
    if ((error as { code?: string }).code === "P2002") {
      const duplicate = await prisma.order.findFirst({ where: { userId, idempotencyKey }, include: orderInclude });
      if (duplicate?.checkoutDigest === signedDigest) return res.status(200).json({ status: "success", data: duplicate, idempotentReplay: true });
    }
    throw error;
  }
});

import { Request, Response } from "express";
import prisma from "../lib/prisma";
import { cartItemSchema } from "../schemas/cartSchema";
import { getCurrentProductPrices } from "../services/pricingService";
import { asyncHandler } from "../utils/asyncHandler";

async function loadCart(userId: string) {
  const cart = await prisma.cart.findUnique({ where: { userId }, include: { items: { orderBy: { createdAt: "asc" } } } });
  if (!cart) return { id: null, items: [] };
  const ids = cart.items.map((item) => item.productId);
  const [products, stocks, prices] = await Promise.all([
    prisma.product.findMany({ where: { id: { in: ids } } }),
    prisma.inventory.groupBy({ by: ["productId"], where: { productId: { in: ids }, warehouse: { isActive: true } }, _sum: { availableQty: true } }),
    getCurrentProductPrices(ids),
  ]);
  const productById = new Map(products.map((product) => [product.id, product]));
  const stockById = new Map(stocks.map((stock) => [stock.productId, stock._sum.availableQty ?? 0]));
  return {
    id: cart.id,
    items: cart.items.map((item) => {
      const product = productById.get(item.productId);
      const price = prices.get(item.productId);
      return {
        productId: item.productId,
        quantity: item.quantity,
        product: product ? { id: product.id, name: product.name, sku: product.sku, category: product.category, imageUrl: product.imageUrl, isActive: product.isActive } : null,
        availableQty: stockById.get(item.productId) ?? 0,
        price: product?.isActive ? price?.price ?? null : null,
        currency: price?.currency ?? null,
        unavailable: !product?.isActive || !price,
      };
    }),
  };
}

export const getCart = asyncHandler(async (_req: Request, res: Response) => {
  const data = await loadCart(res.locals.customer.sub as string);
  return res.status(200).json({ status: "success", data });
});

export const setCartItem = asyncHandler(async (req: Request, res: Response) => {
  const input = cartItemSchema.parse(req.body);
  const userId = res.locals.customer.sub as string;
  const product = await prisma.product.findFirst({ where: { id: input.productId, isActive: true }, select: { id: true } });
  if (!product) return res.status(404).json({ status: "error", message: "Active product not found" });
  const cart = await prisma.cart.upsert({ where: { userId }, create: { userId }, update: {} });
  await prisma.cartItem.upsert({
    where: { cartId_productId: { cartId: cart.id, productId: input.productId } },
    create: { cartId: cart.id, productId: input.productId, quantity: input.quantity },
    update: { quantity: input.quantity },
  });
  return res.status(200).json({ status: "success", data: await loadCart(userId) });
});

export const removeCartItem = asyncHandler(async (req: Request, res: Response) => {
  const userId = res.locals.customer.sub as string;
  const cart = await prisma.cart.findUnique({ where: { userId }, select: { id: true } });
  if (cart) await prisma.cartItem.deleteMany({ where: { cartId: cart.id, productId: req.params.productId } });
  return res.status(200).json({ status: "success", data: await loadCart(userId) });
});

export const clearCart = asyncHandler(async (_req: Request, res: Response) => {
  const userId = res.locals.customer.sub as string;
  const cart = await prisma.cart.findUnique({ where: { userId }, select: { id: true } });
  if (cart) await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
  return res.status(200).json({ status: "success", data: { id: cart?.id ?? null, items: [] } });
});

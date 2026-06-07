import { Request, Response } from "express";
import prisma from "../../lib/prisma";
import { createOrderSchema } from "../../schemas/orderSchema";
import { getCurrentProductPrice } from "../../services/pricingService";
import { asyncHandler } from "../../utils/asyncHandler";

const serializeOrder = (order: any) => ({
  ...order,
  unitPrice: Number(order.unitPrice.toString()),
  totalPrice: Number(order.totalPrice.toString()),
});

export const createOrder = asyncHandler(async (req: Request, res: Response) => {
  const { productId, quantity } = createOrderSchema.parse(req.body);
  const customerId = res.locals.customer.sub as string;
  const [product, pricing] = await Promise.all([
    prisma.product.findFirst({
      where: { id: productId, isActive: true },
      select: { id: true },
    }),
    getCurrentProductPrice(productId),
  ]);
  if (!product)
    return res
      .status(404)
      .json({ status: "error", message: "Product not found" });

  const order = await prisma.$transaction(async (tx: any) => {
    const inventories = await tx.inventory.findMany({
      where: { productId, warehouse: { isActive: true } },
      orderBy: [{ availableQty: "desc" }, { createdAt: "asc" }],
    });
    if (!inventories.length)
      throw new Error("No inventory location is configured for this product");

    const availableQty = inventories.reduce(
      (sum: number, item: any) => sum + item.availableQty,
      0,
    );
    const allocatedQty = Math.min(quantity, availableQty);
    const shortageQty = quantity - allocatedQty;
    const created = await tx.order.create({
      data: {
        userId: customerId,
        productId,
        quantity,
        allocatedQty,
        shortageQty,
        unitPrice: pricing.price,
        totalPrice: Number((pricing.price * quantity).toFixed(2)),
        currency: pricing.currency,
        status: shortageQty > 0 ? "BACKORDERED" : "CONFIRMED",
      },
    });

    let remaining = allocatedQty;
    for (const inventory of inventories) {
      if (remaining <= 0) break;
      const allocation = Math.min(remaining, inventory.availableQty);
      if (allocation <= 0) continue;
      const updated = await tx.inventory.updateMany({
        where: { id: inventory.id, availableQty: { gte: allocation } },
        data: {
          availableQty: { decrement: allocation },
          reservedQty: { increment: allocation },
        },
      });
      if (updated.count !== 1)
        throw new Error(
          "Inventory changed while placing the order. Please retry.",
        );
      await tx.orderAllocation.create({
        data: {
          orderId: created.id,
          inventoryId: inventory.id,
          quantity: allocation,
        },
      });
      remaining -= allocation;
    }

    if (shortageQty > 0) {
      const target = inventories[0];
      await tx.stockReorder.create({
        data: {
          inventoryId: target.id,
          orderId: created.id,
          requestedQty: shortageQty,
        },
      });
      await tx.inventory.update({
        where: { id: target.id },
        data: { isReorderPending: true },
      });
    }

    return tx.order.findUnique({
      where: { id: created.id },
      include: {
        product: {
          select: { id: true, name: true, sku: true, imageUrl: true },
        },
        allocations: true,
        stockReorder: true,
      },
    });
  });

  return res.status(201).json({
    status: "success",
    message:
      order.shortageQty > 0
        ? "Order placed; missing stock was automatically reordered."
        : "Order placed successfully.",
    data: serializeOrder(order),
  });
});

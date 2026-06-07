import { Request, Response } from "express";
import prisma from "../../lib/prisma";
import { asyncHandler } from "../../utils/asyncHandler";

const serializeOrder = (order: any) => ({
  ...order,
  unitPrice: Number(order.unitPrice.toString()),
  totalPrice: Number(order.totalPrice.toString()),
});

export const getCustomerOrders = asyncHandler(
  async (_req: Request, res: Response) => {
    const orders = await prisma.order.findMany({
      where: { userId: res.locals.customer.sub },
      include: {
        product: {
          select: { id: true, name: true, sku: true, imageUrl: true },
        },
        stockReorder: true,
      },
      orderBy: { createdAt: "desc" },
    });
    return res
      .status(200)
      .json({ status: "success", data: orders.map(serializeOrder) });
  },
);

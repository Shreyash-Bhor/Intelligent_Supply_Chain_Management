import { Request, Response } from "express";
import prisma from "../../../lib/prisma";
import { asyncHandler } from "../../../utils/asyncHandler";

const serializeOrder = (order: any) => ({
  ...order,
  unitPrice: Number(order.unitPrice.toString()),
  totalPrice: Number(order.totalPrice.toString()),
});

export const getCustomerOrders = asyncHandler(
  async (req: Request, res: Response) => {
    const page = Number(req.query.page ?? 1);
    const pageSize = Number(req.query.pageSize ?? 20);
    if (!Number.isInteger(page) || page < 1 || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 50) {
      return res.status(400).json({ status: "error", message: "Invalid pagination parameters" });
    }
    const where = { userId: res.locals.customer.sub };
    const [total, orders] = await Promise.all([prisma.order.count({ where }), prisma.order.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        product: {
          select: { id: true, name: true, sku: true, imageUrl: true },
        },
        stockReorder: true,
        items: { include: { product: { select: { id: true, name: true, sku: true, imageUrl: true } } } },
        shipments: true,
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    })]);
    return res
      .status(200)
      .json({ status: "success", data: { items: orders.map(serializeOrder), pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } } });
  },
);

export const getCustomerOrder = asyncHandler(async (req: Request, res: Response) => {
  const order = await prisma.order.findFirst({
    where: { id: req.params.orderId, userId: res.locals.customer.sub },
    include: { product: { select: { id: true, name: true, sku: true, imageUrl: true } }, stockReorder: true, items: { include: { product: { select: { id: true, name: true, sku: true, imageUrl: true } } } }, shipments: true },
  });
  if (!order) return res.status(404).json({ status: "error", message: "Order not found" });
  return res.status(200).json({ status: "success", data: serializeOrder(order) });
});

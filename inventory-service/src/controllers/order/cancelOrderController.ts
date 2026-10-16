import { Request, Response } from "express";
import prisma from "../../lib/prisma";
import { asyncHandler } from "../../utils/asyncHandler";

export const cancelCustomerOrder = asyncHandler(async (req: Request, res: Response) => {
  const userId = res.locals.customer.sub as string;
  try {
    const order = await prisma.$transaction(async (tx: any) => {
      const current = await tx.order.findFirst({
        where: { id: req.params.orderId, userId },
        include: { allocations: true },
      });
      if (!current) return { kind: "missing" as const };
      const cancellable = (current.status === "PENDING_PAYMENT" && current.paymentStatus === "PENDING")
        || (current.status === "CONFIRMED" && current.paymentStatus === "NOT_STARTED");
      if (!cancellable)
        return { kind: "ineligible" as const };

      const claimed = await tx.order.updateMany({
        where: {
          id: current.id,
          userId,
          status: current.status,
          paymentStatus: current.paymentStatus,
        },
        data: { status: "CANCELLED", paymentStatus: "CANCELLED" },
      });
      if (claimed.count !== 1) return { kind: "ineligible" as const };

      for (const allocation of current.allocations) {
        const released = await tx.inventory.updateMany({
          where: { id: allocation.inventoryId, reservedQty: { gte: allocation.quantity } },
          data: { reservedQty: { decrement: allocation.quantity }, availableQty: { increment: allocation.quantity } },
        });
        if (released.count !== 1) throw new Error("Reserved inventory could not be safely released");
      }
      return { kind: "cancelled" as const };
    }, { isolationLevel: "Serializable" });

    if (order.kind === "missing") return res.status(404).json({ status: "error", message: "Order not found" });
    if (order.kind === "ineligible") return res.status(409).json({ status: "error", message: "This order cannot be cancelled in its current payment or order state" });
    const data = await prisma.order.findFirst({
      where: { id: req.params.orderId, userId },
      include: { product: { select: { id: true, name: true, sku: true, imageUrl: true } }, items: { include: { product: { select: { id: true, name: true, sku: true, imageUrl: true } } } }, shipments: true },
    });
    return res.status(200).json({ status: "success", data });
  } catch (error) {
    if ((error as { code?: string }).code === "P2034") return res.status(409).json({ status: "error", message: "Order state changed. Refresh and retry." });
    throw error;
  }
});

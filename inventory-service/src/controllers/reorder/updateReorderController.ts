import { Request, Response } from "express";
import prisma from "../../lib/prisma";
import { updateReorderStatusSchema } from "../../schemas/reorderSchema";
import { asyncHandler } from "../../utils/asyncHandler";

export const updateReorderStatus = asyncHandler(
  async (req: Request, res: Response) => {
    const { reorderId } = req.params;

    if (!reorderId) {
      return res.status(400).json({ message: "Reorder Id is required" });
    }

    const { status } = updateReorderStatusSchema.parse(req.body);

    const reorder = await prisma.stockReorder.findUnique({
      where: {
        id: reorderId,
      },
      include: { inventory: true },
    });

    if (!reorder) {
      return res.status(404).json({ message: "Reorder not found" });
    }

    if (reorder.status !== "PENDING") {
      return res.status(400).json({ message: "Reorder already processed" });
    }

    const result = await prisma.$transaction(async (tx: any) => {
      await tx.stockReorder.update({
        where: { id: reorderId },
        data: { status },
      });

      if (status === "COMPLETED") {
        await tx.inventory.update({
          where: { id: reorder.inventoryId },
          data: {
            availableQty: reorder.inventory.availableQty + reorder.requestedQty,
            isReorderPending: false,
          },
        });
      }

      if (status === "CANCELLED") {
        await tx.inventory.update({
          where: { id: reorder.inventoryId },
          data: {
            isReorderPending: false,
          },
        });
      }
    });

    return res.status(200).json({
      status: "success",
      data: result,
    });
  },
);

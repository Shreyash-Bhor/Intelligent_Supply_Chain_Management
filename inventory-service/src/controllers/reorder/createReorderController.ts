import { Request, Response } from "express";
import prisma from "../../lib/prisma";
import { asyncHandler } from "../../utils/asyncHandler";
import { createStockReorderSchema } from "../../schemas/reorderSchema";

export const createReorder = asyncHandler(
  async (req: Request, res: Response) => {
    const { inventoryId } = req.params;

    if (!inventoryId) {
      return res.status(400).json({ message: "Inventory ID is required" });
    }

    const { requestedQty } = createStockReorderSchema.parse(req.body);

    const inventory = await prisma.inventory.findUnique({
      where: { id: inventoryId },
    });

    if (!inventory) {
      return res.status(404).json({ message: "Inventory not found" });
    }

    const existingPending = await prisma.stockReorder.findFirst({
      where: {
        inventoryId,
        status: "PENDING",
      },
    });

    if (existingPending) {
      return res.status(400).json({
        message: "Pending reorder already exists",
      });
    }

    const reorder = await prisma.$transaction(async (tx: any) => {
      const created = await tx.stockReorder.create({
        data: {
          inventoryId,
          requestedQty,
        },
      });

      await tx.inventory.update({
        where: { id: inventoryId },
        data: { isReorderPending: true },
      });

      return created;
    });

    return res.status(201).json({
      status: "success",
      data: reorder,
    });
  },
);

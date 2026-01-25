import { Request, Response } from "express";
import { createStockReorderSchema } from "../../schemas/reorderSchema";
import prisma from "../../lib/prisma";
import { asyncHandler } from "../../utils/asyncHandler";

export const createReorder = asyncHandler(
  async (req: Request, res: Response) => {
    const { inventoryId } = req.params;
    if (!inventoryId) {
      return res.status(400).json({ error: "Inventory Id is required" });
    }
    const data = createStockReorderSchema.parse(req.body);
    const { requestedQty } = data;
    const reorder = await prisma.stockReorder.create({
      data: {
        inventoryId,
        requestedQty,
      },
    });
    return res
      .status(201)
      .json({
        status: "success",
        message: "Order placed successfully",
        data: reorder,
      });
  },
);

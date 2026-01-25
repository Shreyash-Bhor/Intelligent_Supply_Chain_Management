import { Request, Response } from "express";
import prisma from "../../lib/prisma";
import { updateStockReorderStatusSchema } from "../../schemas/reorderSchema";
import { asyncHandler } from "../../utils/asyncHandler";

export const updateReorderStatus = asyncHandler(
  async (req: Request, res: Response) => {
    const { orderId } = req.params;
    const data = updateStockReorderStatusSchema.parse(req.body);
    const reorderStatus = await prisma.stockReorder.updateMany({
      where: {
        id: orderId,
      },
      data,
    });
    return res.status(200).json({
      status: "success",
      message: "Status updated successfully",
      data: reorderStatus,
    });
  },
);

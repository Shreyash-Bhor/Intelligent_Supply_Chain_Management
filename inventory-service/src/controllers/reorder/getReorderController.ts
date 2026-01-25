import prisma from "../../lib/prisma";
import { getStockReorderDetailsSchema } from "../../schemas/reorderSchema";
import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";

export const getReorderDetails = asyncHandler(
  async (req: Request, res: Response) => {
    const data = getStockReorderDetailsSchema.parse(req.body);
    const { status } = data;
    const details = await prisma.stockReorder.findMany({
      where: { status },
    });
    if (!details) {
      return res
        .status(404)
        .json({ status: "error", message: `No ${status} order available` });
    }
    return res.status(200).json({
      status: "success",
      message: "Order details fetched successfully",
      data: details,
    });
  },
);

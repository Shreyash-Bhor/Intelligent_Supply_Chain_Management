import prisma from "../../lib/prisma";
import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";

export const getReorderDetails = asyncHandler(
  async (req: Request, res: Response) => {
    const details = await prisma.stockReorder.findMany({
      where: { status: "PENDING" },
    });
    return res.status(200).json({
      status: "success",
      message:
        details.length === 0
          ? `No orders found`
          : "Order details fetched successfully",
      data: details,
    });
  },
);

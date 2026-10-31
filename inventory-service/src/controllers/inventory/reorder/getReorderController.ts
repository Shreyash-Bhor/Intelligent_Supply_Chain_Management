import prisma from "../../../lib/prisma";
import { Request, Response } from "express";
import { asyncHandler } from "../../../utils/asyncHandler";
import { getOrLoad } from "../../../lib/cache";

export const getReorderDetails = asyncHandler(
  async (req: Request, res: Response) => {
    const mode =
      typeof req.query.mode === "string" ? req.query.mode : "current";

    const details = await getOrLoad(mode, "reorders", 15, () => prisma.stockReorder.findMany({
      where:
        mode === "history"
          ? { status: { in: ["COMPLETED", "CANCELLED"] } }
          : { status: "PENDING" },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      include: { inventory: { select: { id: true, product: { select: { name: true, sku: true } }, warehouse: { select: { id: true, name: true } } } } },
    }));
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

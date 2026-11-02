import prisma from "../../../lib/prisma";
import { Request, Response } from "express";
import { asyncHandler } from "../../../utils/asyncHandler";
import { getOrLoad } from "../../../lib/cache";
import { Prisma } from "@prisma/client";

export const getReorderDetails = asyncHandler(
  async (req: Request, res: Response) => {
    const mode =
      typeof req.query.mode === "string" ? req.query.mode : "current";
    const page = Number(req.query.page ?? 1);
    const pageSize = Number(req.query.pageSize ?? 100);
    if (!Number.isInteger(page) || page < 1 || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) {
      return res.status(400).json({ status: "error", message: "Invalid pagination parameters" });
    }

    const where: Prisma.StockReorderWhereInput =
        mode === "history"
          ? { status: { in: ["COMPLETED", "CANCELLED"] } }
          : { status: "PENDING" };
    const result = await getOrLoad(`${mode}:p${page}:s${pageSize}`, "reorders", 15, async () => {
      const [total, details] = await Promise.all([
        prisma.stockReorder.count({ where }),
        prisma.stockReorder.findMany({
          where,
          skip: (page - 1) * pageSize,
          take: pageSize,
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          select: {
            id: true, inventoryId: true, requestedQty: true, status: true, createdAt: true, updatedAt: true, orderId: true,
            inventory: { select: { id: true, product: { select: { name: true, sku: true } }, warehouse: { select: { id: true, name: true } } } },
          },
        }),
      ]);
      return { details, pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } };
    });
    const details = result.details;
    return res.status(200).json({
      status: "success",
      message:
        details.length === 0
          ? `No orders found`
          : "Order details fetched successfully",
      data: details,
      pagination: result.pagination,
    });
  },
);

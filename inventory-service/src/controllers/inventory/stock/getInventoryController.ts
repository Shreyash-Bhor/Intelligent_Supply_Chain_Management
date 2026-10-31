import { Request, Response } from "express";
import prisma from "../../../lib/prisma";
import { asyncHandler } from "../../../utils/asyncHandler";
import { getOrLoad } from "../../../lib/cache";

export const getInventoryDetails = asyncHandler(
  async (req: Request, res: Response) => {
    const { inventoryId } = req.params;

    try {
      const inventory = await prisma.inventory.findUnique({
        where: { id: inventoryId },
      });

      if (!inventory) {
        return res
          .status(404)
          .json({ status: "error", message: "No data available" });
      }

      return res.status(200).json({
        status: "success",
        message: "Inventory found successfully",
        data: inventory,
      });
    } catch (error) {
      return res.status(503).json({
        status: "error",
        message: "No data available",
      });
    }
  },
);

export const getAllInventory = asyncHandler(
  async (req: Request, res: Response) => {
    try {
      const page = Number(req.query.page ?? 1);
      const pageSize = Number(req.query.pageSize ?? 50);
      if (!Number.isInteger(page) || page < 1 || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 50) {
        return res.status(400).json({ status: "error", message: "Invalid pagination parameters" });
      }
      const warehouseId = typeof req.query.warehouseId === "string" && req.query.warehouseId !== "all"
        ? req.query.warehouseId
        : undefined;
      const productQuery = typeof req.query.productQuery === "string" ? req.query.productQuery.trim() : "";
      const stockStatus = typeof req.query.stockStatus === "string" ? req.query.stockStatus : "all";
      if (!(["all", "healthy", "low"] as const).includes(stockStatus as "all" | "healthy" | "low")) {
        return res.status(400).json({ status: "error", message: "Invalid stock status filter" });
      }
      const where = {
        ...(warehouseId ? { warehouseId } : {}),
        ...(productQuery ? { product: { OR: [
          { name: { contains: productQuery, mode: "insensitive" as const } },
          { sku: { contains: productQuery, mode: "insensitive" as const } },
        ] } } : {}),
        ...(stockStatus === "low" ? { availableQty: { lte: prisma.inventory.fields.reorderQty } } : {}),
        ...(stockStatus === "healthy" ? { availableQty: { gt: prisma.inventory.fields.reorderQty } } : {}),
      };
      const cacheKey = `p${page}:s${pageSize}:w${warehouseId ?? "all"}:stock${stockStatus}:product${productQuery.toLowerCase()}`;
      const data = await getOrLoad(cacheKey, "inventory", 20, async () => {
        const [total, inventories] = await Promise.all([
          prisma.inventory.count({ where }),
          prisma.inventory.findMany({
            where, skip: (page - 1) * pageSize, take: pageSize,
            orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
            select: {
              id: true, productId: true, warehouseId: true, availableQty: true,
              reservedQty: true, reorderQty: true, isReorderPending: true,
              createdAt: true, updatedAt: true,
              product: { select: { name: true, sku: true } },
              warehouse: { select: { name: true } },
            },
          }),
        ]);
        return { items: inventories, pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } };
      });
      return res.status(200).json({
        status: "success",
        message: "Inventories fetched successfully",
        data,
      });
    } catch (error) {
      return res.status(503).json({
        status: "error",
        message: "No data available",
      });
    }
  },
);
export const getProductAvailability = asyncHandler(
  async (req: Request, res: Response) => {
    const { productId } = req.params;

    if (!productId) {
      return res.status(400).json({
        status: "error",
        message: "Product ID is required",
      });
    }

    const inventory = await prisma.inventory.findMany({
      where: {
        productId,
        warehouse: {
          isActive: true,
        },
        product: {
          isActive: true,
        },
      },
      select: {
        availableQty: true,
      },
    });

    if (inventory.length === 0) {
      return res.status(404).json({
        status: "error",
        message: "No active inventory found for this product",
      });
    }

    const availableQty = inventory.reduce(
      (total, item) => total + item.availableQty,
      0,
    );

    return res.status(200).json({
      status: "success",
      data: {
        productId,
        availableQty,
      },
    });
  },
);

import { Request, Response } from "express";
import { inventorySchema } from "../../schemas/inventorySchema";
import prisma from "../../lib/prisma";
import { asyncHandler } from "../../utils/asyncHandler";

export const createInventory = asyncHandler(async (req: Request, res: Response) => {
    const data = inventorySchema.parse(req.body);
    const {
      productId,
      warehouseId,
      availableQty,
      reservedQty,
      reorderQty,
      isReorderPending,
    } = data;

    const existingInventory = await prisma.inventory.findFirst({
      where: {
        warehouseId,
        productId,
      },
    });
    if (existingInventory) {
      return res.status(409).json({
        status: "conflict",
        message: "Inventory already exists for this product in the warehouse",
      });
    }
    const inventory = await prisma.inventory.create({
      data: {
        productId,
        warehouseId,
        availableQty,
        reservedQty,
        reorderQty,
        isReorderPending,
      },
    });
    return res.status(201).json({
      status: "success",
      message: "Inventory created successfully",
      data: inventory,
    });
  }
);

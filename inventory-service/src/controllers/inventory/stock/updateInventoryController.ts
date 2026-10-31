import { Request, Response } from "express";
import {
  updateInventorySchema,
  updateInventoryStatusSchema,
} from "../../../schemas/inventorySchema";
import prisma from "../../../lib/prisma";
import { asyncHandler } from "../../../utils/asyncHandler";
import { invalidateCache } from "../../../lib/cache";

export const updateInventory = asyncHandler(
  async (req: Request, res: Response) => {
    const { inventoryId } = req.params;
    const data = updateInventorySchema.parse(req.body);

    const inventory = await prisma.inventory.update({
      where: {
        id: inventoryId,
      },
      data,
    });
    await invalidateCache("inventory", "catalog", "dashboard", "warehouses");
    return res.status(200).json({
      status: "success",
      message: "Inventory updated successfully",
      data: inventory,
    });
  },
);

export const updateInventoryStatus = asyncHandler(
  async (req: Request, res: Response) => {
    const { inventoryId } = req.params;
    const { isReorderPending } = updateInventoryStatusSchema.parse(req.body);
    const inventory = await prisma.inventory.update({
      where: {
        id: inventoryId,
      },
      data: { isReorderPending },
    });
    await invalidateCache("inventory", "catalog", "dashboard", "warehouses");
    return res.status(200).json({
      status: "success",
      message: "Inventory status updated successfully",
      data: inventory,
    });
  },
);

import { Request, Response } from "express";
import {
  updateWarehouseSchema,
  updateWarehouseStatusSchema,
} from "../../schemas/warehouseSchema";
import prisma from "../../lib/prisma";
import { asyncHandler } from "../../utils/asyncHandler";
import { invalidateCache } from "../../lib/cache";

export const updateWarehouse = asyncHandler(
  async (req: Request, res: Response) => {
    const { warehouseId } = req.params;
    const data = updateWarehouseSchema.parse(req.body);

    const warehouse = await prisma.warehouse.update({
      where: { id: warehouseId },
      data,
    });
    await invalidateCache("warehouses", "inventory", "catalog", "dashboard");

    return res.status(200).json({
      status: "success",
      message: "Warehouse updated successfully",
      data: warehouse,
    });
  },
);

export const updateWarehouseStatus = asyncHandler(
  async (req: Request, res: Response) => {
    const { warehouseId } = req.params;
    const data = updateWarehouseStatusSchema.parse(req.body);
    const { isActive } = data;

    const warehouse = await prisma.warehouse.update({
      where: { id: warehouseId },
      data: { isActive },
    });
    await invalidateCache("warehouses", "inventory", "catalog", "dashboard");
    return res
      .status(200)
      .json({
        status: "success",
        message: "Warehouse status updated successfully",
        data: warehouse,
      });
  },
);

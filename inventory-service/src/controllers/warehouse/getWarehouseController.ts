import { Request, Response } from "express";
import prisma from "../../lib/prisma";
import { asyncHandler } from "../../utils/asyncHandler";

export const getWarehouseData = asyncHandler(
  async (req: Request, res: Response) => {
    const { warehouseId } = req.params;
    const warehouse = await prisma.warehouse.findUnique({
      where: { id: warehouseId },
      include: {
        inventories: {
          include: {
            product: true,
          },
        },
      },
    });
    if (!warehouse) {
      return res
        .status(404)
        .json({ status: "error", message: "Warehouse not found" });
    }
    return res.status(200).json({
      status: "success",
      message: "Warehouse found successfully",
      data: warehouse,
    });
  },
);

export const getWarehouses = asyncHandler(
  async (req: Request, res: Response) => {
    const warehouses = await prisma.warehouse.findMany({
      where: { isActive: true },
    });
    return res
      .status(200)
      .json({
        status: "success",
        message: "Warehouse data fetch successfully",
        data: warehouses,
      });
  },
);

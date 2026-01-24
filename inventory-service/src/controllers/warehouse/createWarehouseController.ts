import { Request, Response } from "express";
import { createWarehouseSchema } from "../../schemas/warehouseSchema";
import prisma from "../../lib/prisma";
import { asyncHandler } from "../../utils/asyncHandler";

export const createWarehouse = asyncHandler(
  async (req: Request, res: Response) => {
    const data = createWarehouseSchema.parse(req.body);
    const { name, city, pincode } = data;
    const existingWarehouse = await prisma.warehouse.findFirst({
      where: {
        name,
      },
    });
    if (existingWarehouse) {
      return res
        .status(409)
        .json({ status: "conflict", message: "Warehouse already exists" });
    }
    const warehouse = await prisma.warehouse.create({
      data: {
        name,
        city,
        pincode,
      },
    });
    return res.status(201).json({
      status: "success",
      message: "Warehouse created successfully",
      data: warehouse,
    });
  },
);

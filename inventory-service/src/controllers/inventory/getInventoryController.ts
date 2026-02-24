import { Request, Response } from "express";
import prisma from "../../lib/prisma";
import { asyncHandler } from "../../utils/asyncHandler";

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
      const inventories = await prisma.inventory.findMany({
        include: {
          product: {
            select: {
              name: true,
              sku: true,
            },
          },
          warehouse: {
            select: {
              name: true,
            },
          },
        },
      });

      return res.status(200).json({
        status: "success",
        message: "Inventories fetched successfully",
        data: inventories,
      });
    } catch (error) {
      return res.status(503).json({
        status: "error",
        message: "No data available",
      });
    }
  },
);

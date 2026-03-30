import prisma from "../../lib/prisma";
import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
type UserDashboardProduct = {
  id: string;
  name: string;
  imageUrl: string | null;
};
type CatalogProduct = {
  id: string;
  name: string;
  sku: string;
  imageUrl: string | null;
  availableQty: number;
  reservedQty: number;
  warehouseCount: number;
  warehouses: string[];
  updatedAt: Date;
};

export const getProduct = asyncHandler(async (req: Request, res: Response) => {
  const { productId } = req.params;

  const product = await prisma.product.findUnique({
    where: { id: productId },
  });

  if (!product) {
    return res
      .status(404)
      .json({ status: "error", message: "Product not found" });
  }

  return res.status(200).json({
    status: "success",
    message: "Product found successfully",
    data: product,
  });
});

export const getAllProducts = asyncHandler(
  async (req: Request, res: Response) => {
    const statusFilter = req.query.status;

    const whereClause =
      statusFilter === "inactive"
        ? { isActive: false }
        : statusFilter === "all"
          ? {}
          : { isActive: true };

    const products = await prisma.product.findMany({
      where: whereClause,
      orderBy: { createdAt: "desc" },
    });

    return res.status(200).json({
      status: "success",
      message: "Products fetched successfully",
      data: products,
    });
  },
);
export const getUserDashboardProducts = asyncHandler(
  async (_req: Request, res: Response) => {
    const inventoryItems = await prisma.inventory.findMany({
      where: {
        availableQty: { gt: 0 },
        product: { isActive: true },
        warehouse: { isActive: true },
      },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            imageUrl: true,
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    const productsMap = new Map<string, UserDashboardProduct>();

    for (const item of inventoryItems) {
      if (!productsMap.has(item.product.id)) {
        productsMap.set(item.product.id, {
          id: item.product.id,
          name: item.product.name,
          imageUrl: item.product.imageUrl,
        });
      }
    }

    const products = Array.from(productsMap.values()).sort((a, b) =>
      a.name.localeCompare(b.name),
    );

    return res.status(200).json({
      status: "success",
      message: "User dashboard products fetched successfully",
      data: products,
    });
  },
);

export const getCatalogProducts = asyncHandler(
  async (_req: Request, res: Response) => {
    const inventoryItems = await prisma.inventory.findMany({
      where: {
        availableQty: { gt: 0 },
        product: { isActive: true },
        warehouse: { isActive: true },
      },
      include: {
        product: true,
        warehouse: {
          select: {
            name: true,
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    const catalog = new Map<string, CatalogProduct>();

    for (const item of inventoryItems) {
      const current = catalog.get(item.productId);

      if (!current) {
        catalog.set(item.productId, {
          id: item.product.id,
          name: item.product.name,
          sku: item.product.sku,
          imageUrl: item.product.imageUrl,
          availableQty: item.availableQty,
          reservedQty: item.reservedQty,
          warehouseCount: 1,
          warehouses: [item.warehouse.name],
          updatedAt: item.updatedAt,
        });
        continue;
      }

      current.availableQty += item.availableQty;
      current.reservedQty += item.reservedQty;
      current.warehouseCount += 1;

      if (!current.warehouses.includes(item.warehouse.name)) {
        current.warehouses.push(item.warehouse.name);
      }

      if (item.updatedAt > current.updatedAt) {
        current.updatedAt = item.updatedAt;
      }
    }

    return res.status(200).json({
      status: "success",
      message: "Catalog products fetched successfully",
      data: Array.from(catalog.values()).sort(
        (a, b) =>
          b.availableQty - a.availableQty || a.name.localeCompare(b.name),
      ),
    });
  },
);

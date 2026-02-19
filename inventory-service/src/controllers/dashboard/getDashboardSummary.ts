import { Request, Response } from "express";
import prisma from "../../lib/prisma";
import { asyncHandler } from "../../utils/asyncHandler";

export const getDashboardSummary = asyncHandler(
  async (req: Request, res: Response) => {
    const totalProductsPromise = prisma.product.count({
      where: { isActive: true },
    });
    const openOrdersPromise = prisma.stockReorder.count({
      where: { status: "PENDING" },
    });

    const totalUnitsResult = prisma.inventory.aggregate({
      _sum: {
        availableQty: true,
      },
    });

    const inventoriesPromise = prisma.inventory.findMany({
      select: {
        availableQty: true,
        reorderQty: true,
      },
    });

    const stockPerWarehousePromise = prisma.inventory.groupBy({
      by: ["warehouseId"],
      _sum: {
        availableQty: true,
      },
    });

    const recentReordersPromise = prisma.stockReorder.findMany({
      orderBy: {
        createdAt: "desc",
      },
      take: 5,
      include: {
        inventory: {
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
        },
      },
    });

    const [
      totalProducts,
      openOrders,
      totalUnits,
      inventories,
      stockPerWarehouse,
      recentReorders,
    ] = await Promise.all([
      totalProductsPromise,
      openOrdersPromise,
      totalUnitsResult,
      inventoriesPromise,
      stockPerWarehousePromise,
      recentReordersPromise,
    ]);

    const warehouseIds = stockPerWarehouse.map((w) => w.warehouseId);

    const warehouses = await prisma.warehouse.findMany({
      where: {
        id: { in: warehouseIds },
      },
      select: {
        id: true,
        name: true,
      },
    });

    const warehouseMap = new Map(warehouses.map((w) => [w.id, w.name]));

    const stockPerWarehouseFormatted = stockPerWarehouse.map((w) => ({
      warehouseName: warehouseMap.get(w.warehouseId),
      totalUnits: w._sum.availableQty ?? 0,
    }));

    const lowStockCount = inventories.filter(
      (inv) => inv.availableQty <= inv.reorderQty,
    ).length;

    return res.status(200).json({
      status: "success",
      message: "Dashboard summary fetched successfully",
      data: {
        totalProducts,
        openOrders,
        lowStockCount,
        totalUnits: (await totalUnitsResult)._sum.availableQty ?? 0,
        stockPerWarehouse: stockPerWarehouseFormatted,
        recentReorders: recentReorders.map((r) => ({
          id: r.id,
          requestedQty: r.requestedQty,
          status: r.status,
          createdAt: r.createdAt,
          productName: r.inventory.product.name,
          sku: r.inventory.product.sku,
          warehouseName: r.inventory.warehouse.name,
        })),
      },
    });
  },
);

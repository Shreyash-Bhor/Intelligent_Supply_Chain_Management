import { Request, Response } from "express";
import prisma from "../../lib/prisma";
import { asyncHandler } from "../../utils/asyncHandler";

export const getDashboardSummary = asyncHandler(
  async (req: Request, res: Response) => {
    try {
      const totalProductsPromise = prisma.product.count({
        where: { isActive: true },
      });

      const reorderStatusCountsPromise = prisma.stockReorder.groupBy({
        by: ["status"],
        _count: {
          status: true,
        },
      });

      const inventoriesPromise = prisma.inventory.findMany({
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

      const stockPerWarehousePromise = prisma.inventory.groupBy({
        by: ["warehouseId"],
        _sum: {
          availableQty: true,
          reservedQty: true,
        },
      });

      const recentReordersPromise = prisma.stockReorder.findMany({
        orderBy: {
          createdAt: "desc",
        },
        take: 8,
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
        reorderStatusCounts,
        inventories,
        stockPerWarehouse,
        recentReorders,
      ] = await Promise.all([
        totalProductsPromise,
        reorderStatusCountsPromise,
        inventoriesPromise,
        stockPerWarehousePromise,
        recentReordersPromise,
      ]);

      const warehouseIds = stockPerWarehouse.map((w: any) => w.warehouseId);

      const warehouses = await prisma.warehouse.findMany({
        where: {
          id: { in: warehouseIds },
        },
        select: {
          id: true,
          name: true,
        },
      });

      const warehouseMap = new Map(warehouses.map((w: any) => [w.id, w.name]));

      const stockPerWarehouseFormatted = stockPerWarehouse.map((w: any) => {
        const availableUnits = w._sum.availableQty ?? 0;
        const reservedUnits = w._sum.reservedQty ?? 0;

        return {
          warehouseName: warehouseMap.get(w.warehouseId),
          totalUnits: availableUnits,
          reservedUnits,
        };
      });

      const totalUnits = inventories.reduce(
        (acc: number, inv: any) => acc + inv.availableQty,
        0,
      );

      const totalReservedUnits = inventories.reduce(
        (acc: number, inv: any) => acc + inv.reservedQty,
        0,
      );

      const lowStock = inventories.filter(
        (inv: any) => inv.availableQty <= inv.reorderQty,
      );

      const criticalStock = inventories.filter(
        (inv: any) => inv.availableQty <= Math.ceil(inv.reorderQty * 0.5),
      );

      const pendingOrders =
        reorderStatusCounts.find((s: any) => s.status === "PENDING")?._count
          .status ?? 0;

      const completedOrders =
        reorderStatusCounts.find((s: any) => s.status === "COMPLETED")?._count
          .status ?? 0;

      const cancelledOrders =
        reorderStatusCounts.find((s: any) => s.status === "CANCELLED")?._count
          .status ?? 0;

      const totalOrders = pendingOrders + completedOrders + cancelledOrders;

      const fillRate =
        totalUnits + totalReservedUnits === 0
          ? 0
          : Math.round((totalUnits / (totalUnits + totalReservedUnits)) * 100);

      const topRiskItems = lowStock
        .map((inv: any) => ({
          id: inv.id,
          productName: inv.product.name,
          sku: inv.product.sku,
          warehouseName: inv.warehouse.name,
          availableQty: inv.availableQty,
          reorderQty: inv.reorderQty,
          deficit: Math.max(inv.reorderQty - inv.availableQty, 0),
        }))
        .sort((a: any, b: any) => b.deficit - a.deficit)
        .slice(0, 6);

      return res.status(200).json({
        status: "success",
        message: "Dashboard summary fetched successfully",
        data: {
          totalProducts,
          totalUnits,
          totalReservedUnits,
          openOrders: pendingOrders,
          completedOrders,
          cancelledOrders,
          lowStockCount: lowStock.length,
          criticalStockCount: criticalStock.length,
          fillRate,
          inventoryHealthBreakdown: [
            {
              name: "Healthy",
              value: Math.max(inventories.length - lowStock.length, 0),
            },
            {
              name: "Low",
              value: Math.max(lowStock.length - criticalStock.length, 0),
            },
            { name: "Critical", value: criticalStock.length },
          ],
          reorderStatusBreakdown: [
            { name: "Pending", value: pendingOrders },
            { name: "Completed", value: completedOrders },
            { name: "Cancelled", value: cancelledOrders },
          ],
          warehouseUtilization: stockPerWarehouseFormatted.map(
            (warehouse: any) => {
              const warehouseTotal =
                warehouse.totalUnits + warehouse.reservedUnits;

              const utilization =
                warehouseTotal === 0
                  ? 0
                  : Math.min(
                      Math.round(
                        (warehouse.reservedUnits / warehouseTotal) * 100,
                      ),
                      100,
                    );

              return {
                warehouseName: warehouse.warehouseName,
                availableUnits: warehouse.totalUnits,
                reservedUnits: warehouse.reservedUnits,
                utilization,
              };
            },
          ),
          stockPerWarehouse: stockPerWarehouseFormatted,
          recentReorders: recentReorders.map((r: any) => ({
            id: r.id,
            requestedQty: r.requestedQty,
            status: r.status,
            createdAt: r.createdAt,
            productName: r.inventory.product.name,
            sku: r.inventory.product.sku,
            warehouseName: r.inventory.warehouse.name,
          })),
          topRiskItems,
          meta: {
            generatedAt: new Date().toISOString(),
            totalOrders,
            source: "database",
          },
        },
      });
    } catch (error) {
      return res.status(503).json({
        status: "error",
        message: "No data available",
      });
    }
  },
);

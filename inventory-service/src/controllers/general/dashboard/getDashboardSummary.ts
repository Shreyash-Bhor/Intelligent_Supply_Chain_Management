import { Request, Response } from "express";
import prisma from "../../../lib/prisma";
import { asyncHandler } from "../../../utils/asyncHandler";
import { getOrLoad } from "../../../lib/cache";

export const getDashboardSummary = asyncHandler(
  async (req: Request, res: Response) => {
    try {
      const summary = await getOrLoad("summary", "dashboard", 5, async () => {
      const totalProductsPromise = prisma.product.count({
        where: { isActive: true },
      });

      const reorderStatusCountsPromise = prisma.stockReorder.groupBy({
        by: ["status"],
        _count: {
          status: true,
        },
      });

      // Keep full-table stock analytics in PostgreSQL. Loading millions of
      // Inventory rows here made every cache miss allocate a huge JS object graph.
      const inventoryMetricsPromise = prisma.$queryRaw<Array<{
        inventoryCount: bigint;
        totalUnits: bigint | null;
        totalReservedUnits: bigint | null;
        lowStockCount: bigint;
        criticalStockCount: bigint;
      }>>`
        SELECT COUNT(*) AS "inventoryCount",
               COALESCE(SUM("availableQty"), 0) AS "totalUnits",
               COALESCE(SUM("reservedQty"), 0) AS "totalReservedUnits",
               COUNT(*) FILTER (WHERE "availableQty" <= "reorderQty") AS "lowStockCount",
               COUNT(*) FILTER (WHERE "availableQty" <= CEIL("reorderQty" * 0.5)) AS "criticalStockCount"
        FROM "Inventory"
      `;
      const topRiskPromise = prisma.$queryRaw<Array<{
        id: string;
        productName: string;
        sku: string;
        warehouseName: string;
        availableQty: number;
        reorderQty: number;
        deficit: number;
      }>>`
        SELECT i.id, p.name AS "productName", p.sku,
               w.name AS "warehouseName", i."availableQty", i."reorderQty",
               GREATEST(i."reorderQty" - i."availableQty", 0) AS deficit
        FROM "Inventory" i
        JOIN "Product" p ON p.id = i."productId"
        JOIN "Warehouse" w ON w.id = i."warehouseId"
        WHERE i."availableQty" <= i."reorderQty"
        ORDER BY deficit DESC, i.id ASC
        LIMIT 6
      `;

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
        select: {
          id: true,
          requestedQty: true,
          status: true,
          createdAt: true,
          inventory: {
            select: {
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

      const warehousesPromise = prisma.warehouse.findMany({
        select: { id: true, name: true },
      });

      const [
        totalProducts,
        reorderStatusCounts,
        inventoryMetrics,
        topRiskItems,
        stockPerWarehouse,
        recentReorders,
        warehouses,
      ] = await Promise.all([
        totalProductsPromise,
        reorderStatusCountsPromise,
        inventoryMetricsPromise,
        topRiskPromise,
        stockPerWarehousePromise,
        recentReordersPromise,
        warehousesPromise,
      ]);

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

      const metrics = inventoryMetrics[0];
      const inventoryCount = Number(metrics?.inventoryCount ?? 0);
      const totalUnits = Number(metrics?.totalUnits ?? 0);
      const totalReservedUnits = Number(metrics?.totalReservedUnits ?? 0);
      const lowStockCount = Number(metrics?.lowStockCount ?? 0);
      const criticalStockCount = Number(metrics?.criticalStockCount ?? 0);

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

      return {
        status: "success",
        message: "Dashboard summary fetched successfully",
        data: {
          totalProducts,
          totalUnits,
          totalReservedUnits,
          openOrders: pendingOrders,
          completedOrders,
          cancelledOrders,
          lowStockCount,
          criticalStockCount,
          fillRate,
          inventoryHealthBreakdown: [
            {
              name: "Healthy",
              value: Math.max(inventoryCount - lowStockCount, 0),
            },
            {
              name: "Low",
              value: Math.max(lowStockCount - criticalStockCount, 0),
            },
            { name: "Critical", value: criticalStockCount },
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
      };
      });
      return res.status(200).json(summary);
    } catch (error) {
      return res.status(503).json({
        status: "error",
        message: "No data available",
      });
    }
  },
);

import prisma from "../../../lib/prisma";
import { Request, Response } from "express";
import { asyncHandler } from "../../../utils/asyncHandler";
import { getOrLoad } from "../../../lib/cache";

export const getWarehouseData = asyncHandler(
  async (req: Request, res: Response) => {
    const warehouseId = req.params.warehouseId ?? "";
    const page = Number(req.query.page ?? 1);
    const pageSize = Number(req.query.pageSize ?? 100);
    if (
      !Number.isInteger(page) ||
      page < 1 ||
      !Number.isInteger(pageSize) ||
      pageSize < 1 ||
      pageSize > 100
    ) {
      return res
        .status(400)
        .json({ status: "error", message: "Invalid pagination parameters" });
    }

    const warehouse = await prisma.warehouse.findUnique({
      where: { id: warehouseId },
    });

    if (!warehouse) {
      return res
        .status(404)
        .json({ status: "error", message: "Warehouse not found" });
    }

    const [total, inventories] = await Promise.all([
      prisma.inventory.count({ where: { warehouseId } }),
      prisma.inventory.findMany({
        where: { warehouseId },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
        include: { product: true },
      }),
    ]);

    return res.status(200).json({
      status: "success",
      message: "Warehouse found successfully",
      data: {
        ...warehouse,
        inventories,
        inventoryPagination: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize),
        },
      },
    });
  },
);

export const getWarehouses = asyncHandler(
  async (req: Request, res: Response) => {
    const statusFilter = req.query.status;
    const page = Number(req.query.page ?? 1);
    const pageSize = Number(req.query.pageSize ?? 100);
    if (
      !Number.isInteger(page) ||
      page < 1 ||
      !Number.isInteger(pageSize) ||
      pageSize < 1 ||
      pageSize > 100
    ) {
      return res
        .status(400)
        .json({ status: "error", message: "Invalid pagination parameters" });
    }

    const whereClause =
      statusFilter === "inactive"
        ? { isActive: false }
        : statusFilter === "all"
          ? {}
          : { isActive: true };

    const result = await getOrLoad(
      `${String(statusFilter ?? "active")}:p${page}:s${pageSize}`,
      "warehouses",
      30,
      async () => {
        const [total, warehouses] = await Promise.all([
          prisma.warehouse.count({ where: whereClause }),
          prisma.warehouse.findMany({
            where: whereClause,
            orderBy: [{ createdAt: "desc" }, { id: "asc" }],
            skip: (page - 1) * pageSize,
            take: pageSize,
          }),
        ]);
        return {
          warehouses,
          pagination: {
            page,
            pageSize,
            total,
            totalPages: Math.ceil(total / pageSize),
          },
        };
      },
    );

    return res.status(200).json({
      status: "success",
      message: "Warehouse data fetch successfully",
      data: result.warehouses,
      pagination: result.pagination,
    });
  },
);

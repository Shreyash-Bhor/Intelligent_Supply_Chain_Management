import { Request, Response } from "express";
import { z } from "zod";
import prisma from "../../../lib/prisma";
import { asyncHandler } from "../../../utils/asyncHandler";

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
  search: z.string().trim().max(120).default(""),
  status: z.enum(["all", "PENDING_PAYMENT", "CONFIRMED", "BACKORDERED", "CANCELLED", "FULFILLED"]).default("all"),
  warehouseId: z.string().uuid().optional(),
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
  sort: z.enum(["date", "value", "status"]).default("date"),
  direction: z.enum(["asc", "desc"]).default("desc"),
});

export const getManagerOrders = asyncHandler(async (req: Request, res: Response) => {
  const parsed = querySchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ status: "error", message: "Invalid order query parameters" });
  const { page, pageSize, search, status, warehouseId, from, to, sort, direction } = parsed.data;
  if (from && to && new Date(from) > new Date(to)) return res.status(400).json({ status: "error", message: "The start date must be before the end date" });
  const createdAt = { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) };
  const where = {
    ...(Object.keys(createdAt).length ? { createdAt } : {}),
    ...(status !== "all" ? { status } : {}),
    ...(warehouseId ? { allocations: { some: { inventory: { warehouseId } } } } : {}),
    ...(search ? { OR: [
      { id: { contains: search, mode: "insensitive" as const } },
      { user: { name: { contains: search, mode: "insensitive" as const } } },
      { user: { email: { contains: search, mode: "insensitive" as const } } },
    ] } : {}),
  };
  const orderBy = sort === "value" ? { totalPrice: direction } : sort === "status" ? { status: direction } : { createdAt: direction };
  const [total, records, warehouses] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.findMany({
      where, skip: (page - 1) * pageSize, take: pageSize, orderBy: [orderBy, { id: "desc" }],
      select: {
        id: true, status: true, createdAt: true, updatedAt: true, totalPrice: true, unitPrice: true, quantity: true, allocatedQty: true, shortageQty: true, currency: true,
        shippingName: true, shippingPhone: true, shippingAddress1: true, shippingAddress2: true, shippingCity: true, shippingRegion: true, shippingPostalCode: true, shippingCountry: true,
        user: { select: { id: true, name: true, email: true } },
        product: { select: { id: true, name: true, sku: true } },
        items: { select: { id: true, quantity: true, unitPrice: true, totalPrice: true, product: { select: { id: true, name: true, sku: true } } } },
        allocations: { select: { quantity: true, inventory: { select: { warehouse: { select: { id: true, name: true, city: true, pincode: true } } } } } },
        shipments: { select: { status: true, shippedAt: true, deliveredAt: true, createdAt: true, carrier: true, trackingNumber: true } },
      },
    }),
    prisma.warehouse.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true, city: true } }),
  ]);
  return res.status(200).json({ status: "success", data: {
    items: records.map((order) => ({ ...order, totalPrice: Number(order.totalPrice), unitPrice: Number(order.unitPrice), items: order.items.map((item) => ({ ...item, unitPrice: Number(item.unitPrice), totalPrice: Number(item.totalPrice) })) })),
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    warehouses,
  } });
});

export const getManagerOrderAnalytics = asyncHandler(async (req: Request, res: Response) => {
  const schema = z.object({ from: z.string().datetime({ offset: true }), to: z.string().datetime({ offset: true }) });
  const parsed = schema.safeParse(req.query);
  if (!parsed.success || new Date(parsed.data.to) < new Date(parsed.data.from)) return res.status(400).json({ status: "error", message: "A valid analytics date range is required" });
  const from = new Date(parsed.data.from); const to = new Date(parsed.data.to);
  const where = { createdAt: { gte: from, lte: to } };
  const [totals, statusCounts, daily, products, warehouseDistribution] = await Promise.all([
    prisma.order.aggregate({ where, _count: { _all: true }, _sum: { totalPrice: true } }),
    prisma.order.groupBy({ by: ["status"], where, _count: { _all: true } }),
    prisma.$queryRaw<Array<{ bucket: Date; orders: bigint; revenue: unknown }>>`
      SELECT date_trunc(${(to.getTime() - from.getTime()) > 90 * 86400000 ? "month" : (to.getTime() - from.getTime()) > 14 * 86400000 ? "week" : "day"}, "createdAt") AS bucket,
             COUNT(*)::bigint AS orders, COALESCE(SUM("totalPrice"), 0) AS revenue
      FROM "Order" WHERE "createdAt" >= ${from} AND "createdAt" <= ${to}
      GROUP BY bucket ORDER BY bucket ASC`,
    prisma.$queryRaw<Array<{ productId: string; quantity: bigint }>>`
      SELECT sales."productId", SUM(sales.quantity)::bigint AS quantity FROM (
        SELECT oi."productId", oi.quantity FROM "OrderItem" oi
        JOIN "Order" o ON o.id = oi."orderId"
        WHERE o."createdAt" >= ${from} AND o."createdAt" <= ${to}
        UNION ALL
        SELECT o."productId", o.quantity FROM "Order" o
        WHERE o."createdAt" >= ${from} AND o."createdAt" <= ${to}
          AND NOT EXISTS (SELECT 1 FROM "OrderItem" oi WHERE oi."orderId" = o.id)
      ) sales GROUP BY sales."productId" ORDER BY quantity DESC LIMIT 5`,
    prisma.$queryRaw<Array<{ warehouseId: string; name: string; count: bigint }>>`
      SELECT w.id AS "warehouseId", w.name, COUNT(DISTINCT a."orderId")::bigint AS count
      FROM "OrderAllocation" a JOIN "Order" o ON o.id = a."orderId"
      JOIN "Inventory" i ON i.id = a."inventoryId" JOIN "Warehouse" w ON w.id = i."warehouseId"
      WHERE o."createdAt" >= ${from} AND o."createdAt" <= ${to}
      GROUP BY w.id, w.name ORDER BY count DESC LIMIT 12`,
  ]);
  const productIds = products.map((row) => row.productId);
  const [productRows] = await Promise.all([
    productIds.length ? prisma.product.findMany({ where: { id: { in: productIds } }, select: { id: true, name: true } }) : [],
  ]);
  const statusMap = new Map(statusCounts.map((item) => [item.status, item._count._all]));
  const productById = new Map(productRows.map((row) => [row.id, row.name]));
  return res.status(200).json({ status: "success", data: {
    totalOrders: totals._count._all, totalRevenue: Number(totals._sum.totalPrice ?? 0),
    pendingOrders: statusMap.get("PENDING_PAYMENT") ?? 0, processingOrders: (statusMap.get("CONFIRMED") ?? 0) + (statusMap.get("BACKORDERED") ?? 0),
    deliveredOrders: statusMap.get("FULFILLED") ?? 0, cancelledOrders: statusMap.get("CANCELLED") ?? 0,
    statusDistribution: statusCounts.map((item) => ({ name: item.status, value: item._count._all })),
    trends: daily.map((item) => ({ date: item.bucket.toISOString(), orders: Number(item.orders), revenue: Number(item.revenue) })),
    topProducts: products.map((item) => ({ name: productById.get(item.productId) ?? "Product", quantity: Number(item.quantity) })),
    warehouses: warehouseDistribution.map((item) => ({ ...item, count: Number(item.count) })),
  } });
});

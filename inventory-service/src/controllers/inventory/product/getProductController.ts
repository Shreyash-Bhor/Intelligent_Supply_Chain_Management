import prisma from "../../../lib/prisma";
import { Request, Response } from "express";
import { asyncHandler } from "../../../utils/asyncHandler";
import { Category } from "@prisma/client";
import { getCurrentProductPrices } from "../../../services/pricingService";
import { getOrLoad } from "../../../lib/cache";
type UserDashboardProduct = {
  id: string;
  name: string;
  imageUrl: string | null;
  availableQty: number;
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

function resolveCategory(rawCategory: string): Category | undefined {
  const normalized = rawCategory
    .trim()
    .replace(/[\s-]+/g, "_")
    .toLowerCase();
  return Object.values(Category).find(
    (value) => value.toLowerCase() === normalized,
  );
}

async function getAssistantPrices(productIds: string[], maxPrice?: number) {
  try {
    return await getCurrentProductPrices(productIds);
  } catch (error) {
    // Product discovery should still work when pricing is temporarily down.
    // A max-price filter cannot be applied without authoritative prices.
    if (maxPrice !== undefined) throw error;
    return new Map<string, { price: string; currency: string }>();
  }
}

export const getProduct = asyncHandler(async (req: Request, res: Response) => {
  const productId = req.params.productId ?? "";

  const product = await getOrLoad(productId, "products", 30, () =>
    prisma.product.findUnique({ where: { id: productId } }),
  );

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
    const statusFilter = req.query.status;

    const whereClause =
      statusFilter === "inactive"
        ? { isActive: false }
        : statusFilter === "all"
          ? {}
          : { isActive: true };

    const products = await getOrLoad(
      `${String(statusFilter ?? "active")}:p${page}:s${pageSize}`,
      "products",
      30,
      async () => {
        const [total, products] = await Promise.all([
          prisma.product.count({ where: whereClause }),
          prisma.product.findMany({
            where: whereClause,
            orderBy: [{ createdAt: "desc" }, { id: "asc" }],
            skip: (page - 1) * pageSize,
            take: pageSize,
          }),
        ]);
        return {
          products,
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
      message: "Products fetched successfully",
      data: products.products,
      pagination: products.pagination,
    });
  },
);
export const getUserDashboardProducts = asyncHandler(
  async (_req: Request, res: Response) => {
    // This legacy assistant endpoint returns the full customer catalog. Keep
    // the aggregation in PostgreSQL, but do not duplicate its full payload in Redis.
    const products = await prisma.$queryRaw<
      Array<{
        id: string;
        name: string;
        sku: string;
        category: Category;
        createdAt: Date;
        imageUrl: string | null;
        availableQty: number;
      }>
    >`
        SELECT p.id, p.name, p.sku, p.category, p."createdAt", p."imageUrl",
               COALESCE(SUM(i."availableQty"), 0)::int AS "availableQty"
        FROM "Product" p
        JOIN "Inventory" i ON i."productId" = p.id
        JOIN "Warehouse" w ON w.id = i."warehouseId" AND w."isActive" = TRUE
        WHERE p."isActive" = TRUE
        GROUP BY p.id
        ORDER BY p.name ASC
      `;

    return res.status(200).json({
      status: "success",
      message: "User dashboard products fetched successfully",
      data: products,
    });
  },
);

export const getPagedUserCatalog = asyncHandler(
  async (req: Request, res: Response) => {
    const page = Number(req.query.page ?? 1);
    const pageSize = Number(req.query.pageSize ?? 12);
    const query =
      typeof req.query.query === "string" ? req.query.query.trim() : "";
    const rawCategory =
      typeof req.query.category === "string" ? req.query.category : "";
    const category = resolveCategory(rawCategory);
    const inStock = req.query.inStock === "true";
    const sort = req.query.sort ?? "name";
    if (
      !Number.isInteger(page) ||
      page < 1 ||
      page > 100000 ||
      !Number.isInteger(pageSize) ||
      pageSize < 1 ||
      pageSize > 100 ||
      query.length > 200 ||
      (req.query.inStock !== undefined &&
        !["true", "false"].includes(String(req.query.inStock))) ||
      (rawCategory && !category) ||
      !["name", "newest", "price-asc", "price-desc", "stock"].includes(
        String(sort),
      ) ||
      (page > 1000 &&
        ["price-asc", "price-desc", "stock"].includes(String(sort)))
    ) {
      return res
        .status(400)
        .json({ status: "error", message: "Invalid catalog query parameters" });
    }
    const where: any = {
      isActive: true,
      ...(category ? { category } : {}),
      ...(query
        ? {
            OR: [
              { name: { contains: query, mode: "insensitive" } },
              { sku: { contains: query, mode: "insensitive" } },
            ],
          }
        : {}),
      inventories: {
        some: {
          warehouse: { isActive: true },
          ...(inStock ? { availableQty: { gt: 0 } } : {}),
        },
      },
    };
    const cacheKey = JSON.stringify({
      page,
      pageSize,
      query: query.toLowerCase(),
      category,
      inStock,
      sort,
    });
    const catalogPage = await getOrLoad(cacheKey, "catalog", 10, async () => {
      const total = await prisma.product.count({ where });
      let orderedIds: string[] | undefined;
      if (sort === "price-asc" || sort === "price-desc") {
        const keep = page * pageSize;
        const ranked: Array<{ id: string; price: number | null }> = [];
        const compare = (
          a: { id: string; price: number | null },
          b: { id: string; price: number | null },
        ) => {
          const diff =
            a.price == null
              ? b.price == null
                ? 0
                : 1
              : b.price == null
                ? -1
                : a.price - b.price;
          return (
            (sort === "price-asc" ? diff : -diff) || a.id.localeCompare(b.id)
          );
        };
        for (let offset = 0; offset < total; offset += 100) {
          const batch = await prisma.product.findMany({
            where,
            select: { id: true },
            orderBy: { id: "asc" },
            skip: offset,
            take: 100,
          });
          const prices = await getCurrentProductPrices(
            batch.map(({ id }) => id),
          );
          for (const { id } of batch) {
            const price = prices.get(id)?.price;
            ranked.push({
              id,
              price: price == null ? null : Math.round(Number(price) * 100),
            });
          }
          ranked.sort(compare);
          if (ranked.length > keep) ranked.length = keep;
        }
        orderedIds = ranked.slice((page - 1) * pageSize).map(({ id }) => id);
      } else if (sort === "stock") {
        const keep = page * pageSize;
        const ranked: Array<{ id: string; stock: number }> = [];
        for (let offset = 0; offset < total; offset += 500) {
          const batch = await prisma.product.findMany({
            where,
            select: { id: true },
            orderBy: { id: "asc" },
            skip: offset,
            take: 500,
          });
          const stock = await prisma.inventory.groupBy({
            by: ["productId"],
            where: {
              productId: { in: batch.map((item) => item.id) },
              warehouse: { isActive: true },
            },
            _sum: { availableQty: true },
          });
          const totals = new Map(
            stock.map((item) => [item.productId, item._sum.availableQty ?? 0]),
          );
          ranked.push(
            ...batch.map(({ id }) => ({ id, stock: totals.get(id) ?? 0 })),
          );
          ranked.sort((a, b) => b.stock - a.stock || a.id.localeCompare(b.id));
          if (ranked.length > keep) ranked.length = keep;
        }
        orderedIds = ranked.slice((page - 1) * pageSize).map(({ id }) => id);
      }
      const idsForPage = orderedIds?.slice(
        (page - 1) * pageSize,
        page * pageSize,
      );
      const products = await prisma.product.findMany({
        where: { ...where, ...(idsForPage ? { id: { in: idsForPage } } : {}) },
        select: {
          id: true,
          name: true,
          sku: true,
          category: true,
          createdAt: true,
          imageUrl: true,
          inventories: {
            where: { warehouse: { isActive: true } },
            select: {
              availableQty: true,
              reservedQty: true,
              warehouse: { select: { name: true } },
            },
          },
        },
        orderBy:
          sort === "newest"
            ? [{ createdAt: "desc" }, { id: "asc" }]
            : sort === "stock"
              ? [{ id: "asc" }]
              : [{ name: "asc" }, { id: "asc" }],
        ...(idsForPage ? {} : { skip: (page - 1) * pageSize, take: pageSize }),
      });
      const byId = new Map(products.map((product) => [product.id, product]));
      const data = (
        idsForPage
          ? idsForPage.map((id) => byId.get(id)).filter(Boolean)
          : products
      ).map((product: any) => ({
        id: product.id,
        name: product.name,
        sku: product.sku,
        category: product.category,
        createdAt: product.createdAt,
        imageUrl: product.imageUrl,
        availableQty: product.inventories.reduce(
          (sum: number, item: any) => sum + item.availableQty,
          0,
        ),
        reservedQty: product.inventories.reduce(
          (sum: number, item: any) => sum + item.reservedQty,
          0,
        ),
        warehouses: [
          ...new Set(
            product.inventories.map((item: any) => item.warehouse.name),
          ),
        ],
      }));
      return {
        data,
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize),
        },
      };
    });
    return res.status(200).json({ status: "success", data: catalogPage });
  },
);

/** Small assistant lookup: return at most three fully described active products. */
export const getAssistantCategoryProducts = asyncHandler(
  async (req: Request, res: Response) => {
    const rawCategory =
      typeof req.query.category === "string" ? req.query.category.trim() : "";
    const category = Object.values(Category).find(
      (value) => value.toLowerCase() === rawCategory.toLowerCase(),
    );
    if (!category)
      return res
        .status(400)
        .json({
          status: "error",
          message: "A valid product category is required.",
        });

    const data = await getOrLoad(
      `assistant-category:${category}`,
      "catalog",
      15,
      async () => {
        const products = await prisma.product.findMany({
          where: { category, isActive: true },
          select: {
            id: true,
            name: true,
            sku: true,
            category: true,
            imageUrl: true,
            inventories: {
              where: { warehouse: { isActive: true } },
              select: { availableQty: true },
            },
          },
          orderBy: { name: "asc" },
          take: 3,
        });
        const prices = await getAssistantPrices(products.map(({ id }) => id));
        return products.map(({ inventories, ...product }) => ({
          ...product,
          availableQty: inventories.reduce(
            (sum: number, item: { availableQty: number }) =>
              sum + item.availableQty,
            0,
          ),
          ...(prices.get(product.id) ?? { price: null, currency: null }),
        }));
      },
    );
    return res.status(200).json({ status: "success", data });
  },
);

/** Search for assistant cards with price and stock included in the same response. */
export const searchAssistantProducts = asyncHandler(
  async (req: Request, res: Response) => {
    const query =
      typeof req.query.query === "string" ? req.query.query.trim() : "";
    const rawCategory =
      typeof req.query.category === "string" ? req.query.category.trim() : "";
    const rawMaxPrice = req.query.maxPrice;
    const inStock = req.query.inStock === "true";
    const category = rawCategory ? resolveCategory(rawCategory) : undefined;
    const maxPrice =
      rawMaxPrice === undefined ? undefined : Number(rawMaxPrice);
    if (
      query.length > 200 ||
      (rawCategory && !category) ||
      (rawMaxPrice !== undefined &&
        (!Number.isFinite(maxPrice) || maxPrice! < 0)) ||
      (req.query.inStock !== undefined &&
        !["true", "false"].includes(String(req.query.inStock)))
    ) {
      return res
        .status(400)
        .json({
          status: "error",
          message: "Invalid assistant product search parameters",
        });
    }
    const cacheKey = `assistant-search:${JSON.stringify({ query: query.toLowerCase(), category, maxPrice, inStock })}`;
    const data = await getOrLoad(cacheKey, "catalog", 10, async () => {
      const products = await prisma.product.findMany({
        where: {
          isActive: true,
          ...(category ? { category } : {}),
          ...(query
            ? {
                OR: [
                  { name: { contains: query, mode: "insensitive" } },
                  { sku: { contains: query, mode: "insensitive" } },
                ],
              }
            : {}),
          ...(inStock
            ? {
                inventories: {
                  some: {
                    warehouse: { isActive: true },
                    availableQty: { gt: 0 },
                  },
                },
              }
            : {}),
        },
        select: {
          id: true,
          name: true,
          sku: true,
          category: true,
          imageUrl: true,
          inventories: {
            where: { warehouse: { isActive: true } },
            select: { availableQty: true },
          },
        },
        orderBy: { name: "asc" },
        take: 30,
      });
      const prices = await getAssistantPrices(
        products.map(({ id }) => id),
        maxPrice,
      );
      return products
        .map(({ inventories, ...product }) => ({
          ...product,
          description: null,
          attributes: {},
          availableQty: inventories.reduce(
            (sum: number, item: { availableQty: number }) =>
              sum + item.availableQty,
            0,
          ),
          ...(prices.get(product.id) ?? { price: null, currency: null }),
        }))
        .filter(
          (product) =>
            maxPrice === undefined ||
            (product.price !== null && Number(product.price) <= maxPrice),
        )
        .slice(0, 3);
    });
    return res.status(200).json({ status: "success", data });
  },
);

export const getCatalogProducts = asyncHandler(
  async (_req: Request, res: Response) => {
    const catalog = await prisma.$queryRaw<CatalogProduct[]>`
      SELECT p.id, p.name, p.sku, p."imageUrl",
             SUM(i."availableQty")::int AS "availableQty",
             SUM(i."reservedQty")::int AS "reservedQty",
             COUNT(DISTINCT i."warehouseId")::int AS "warehouseCount",
             ARRAY_AGG(DISTINCT w.name) AS warehouses,
             MAX(i."updatedAt") AS "updatedAt"
      FROM "Inventory" i
      JOIN "Product" p ON p.id = i."productId" AND p."isActive" = TRUE
      JOIN "Warehouse" w ON w.id = i."warehouseId" AND w."isActive" = TRUE
      WHERE i."availableQty" > 0
      GROUP BY p.id
      ORDER BY SUM(i."availableQty") DESC, p.name ASC
    `;

    return res.status(200).json({
      status: "success",
      message: "Catalog products fetched successfully",
      data: catalog,
    });
  },
);
export const searchProducts = asyncHandler(
  async (req: Request, res: Response) => {
    const { query, category } = req.query;

    // Validate and normalize category
    const categoryValue = category
      ? String(category).trim().toLowerCase()
      : undefined;

    const validCategory = categoryValue
      ? Object.values(Category).find(
          (value) => value.toLowerCase() === categoryValue,
        )
      : undefined;

    if (categoryValue && !validCategory) {
      return res.status(400).json({
        status: "error",
        message: "Invalid product category",
      });
    }

    const searchQuery = typeof query === "string" ? query.trim() : undefined;

    const products = await getOrLoad(
      JSON.stringify({
        query: searchQuery?.toLowerCase() ?? "",
        category: validCategory ?? "",
      }),
      "products",
      15,
      () =>
        prisma.product.findMany({
          where: {
            isActive: true,

            ...(searchQuery
              ? {
                  OR: [
                    {
                      name: {
                        contains: searchQuery,
                        mode: "insensitive",
                      },
                    },
                    {
                      sku: {
                        contains: searchQuery,
                        mode: "insensitive",
                      },
                    },
                  ],
                }
              : {}),

            ...(validCategory ? { category: validCategory } : {}),
          },

          select: {
            id: true,
            name: true,
            sku: true,
            category: true,
            imageUrl: true,
            isActive: true,
          },

          orderBy: {
            name: "asc",
          },

          take: 3,
        }),
    );

    return res.status(200).json({
      status: "success",
      message: "Products searched successfully",
      data: products,
    });
  },
);

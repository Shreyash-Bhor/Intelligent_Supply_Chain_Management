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

export const getProduct = asyncHandler(async (req: Request, res: Response) => {
  const productId = req.params.productId ?? "";

  const product = await getOrLoad(productId, "products", 30, () => prisma.product.findUnique({ where: { id: productId } }));

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

    const products = await getOrLoad(String(statusFilter ?? "active"), "products", 30, () => prisma.product.findMany({ where: whereClause, orderBy: { createdAt: "desc" } }));

    return res.status(200).json({
      status: "success",
      message: "Products fetched successfully",
      data: products,
    });
  },
);
export const getUserDashboardProducts = asyncHandler(
  async (_req: Request, res: Response) => {
    const products = await getOrLoad("active-dashboard", "catalog", 15, async () => {
    const products = await prisma.product.findMany({
      where: {
        isActive: true,
        inventories: { some: { warehouse: { isActive: true } } },
      },
      select: {
        id: true,
        name: true,
        sku: true,
        category: true,
        createdAt: true,
        imageUrl: true,
        inventories: {
          where: { warehouse: { isActive: true } },
          select: { availableQty: true },
        },
      },
      orderBy: { name: "asc" },
    });

    return products.map(
      ({ inventories, ...product }: { inventories: Array<{ availableQty: number }>; id: string; name: string; sku: string; category: Category; createdAt: Date; imageUrl: string | null }) => ({
        ...product,
        availableQty: inventories.reduce((sum, item) => sum + item.availableQty, 0),
      }),
    );
    });

    return res.status(200).json({
      status: "success",
      message: "User dashboard products fetched successfully",
      data: products,
    });
  },
);

export const getPagedUserCatalog = asyncHandler(async (req: Request, res: Response) => {
  const page = Number(req.query.page ?? 1);
  const pageSize = Number(req.query.pageSize ?? 12);
  const query = typeof req.query.query === "string" ? req.query.query.trim() : "";
  const rawCategory = typeof req.query.category === "string" ? req.query.category : "";
  const category = Object.values(Category).find((value) => value.toLowerCase() === rawCategory.toLowerCase());
  const inStock = req.query.inStock === "true";
  const sort = req.query.sort ?? "name";
  if (!Number.isInteger(page) || page < 1 || page > 100000 || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100 || query.length > 200 || (req.query.inStock !== undefined && !["true", "false"].includes(String(req.query.inStock))) || (rawCategory && !category) || !["name", "newest", "price-asc", "price-desc", "stock"].includes(String(sort))) {
    return res.status(400).json({ status: "error", message: "Invalid catalog query parameters" });
  }
  const where: any = {
    isActive: true,
    ...(category ? { category } : {}),
    ...(query ? { OR: [{ name: { contains: query, mode: "insensitive" } }, { sku: { contains: query, mode: "insensitive" } }] } : {}),
    inventories: { some: { warehouse: { isActive: true }, ...(inStock ? { availableQty: { gt: 0 } } : {}) } },
  };
  const cacheKey = JSON.stringify({ page, pageSize, query: query.toLowerCase(), category, inStock, sort });
  const catalogPage = await getOrLoad(cacheKey, "catalog", 10, async () => {
  const total = await prisma.product.count({ where });
  let orderedIds: string[] | undefined;
  if (sort === "price-asc" || sort === "price-desc") {
    const all = await prisma.product.findMany({ where, select: { id: true } });
    const priceMap = new Map<string, { price: string; currency: string }>();
    for (let offset = 0; offset < all.length; offset += 100) {
      const prices = await getCurrentProductPrices(all.slice(offset, offset + 100).map((item) => item.id));
      prices.forEach((value, id) => priceMap.set(id, value));
    }
    orderedIds = all.sort((a, b) => {
      const left = priceMap.get(a.id)?.price;
      const right = priceMap.get(b.id)?.price;
      const diff = left == null ? (right == null ? 0 : 1) : right == null ? -1 : Math.round(Number(left) * 100) - Math.round(Number(right) * 100);
      return (sort === "price-asc" ? diff : -diff) || a.id.localeCompare(b.id);
    }).map((item) => item.id);
  } else if (sort === "stock") {
    const all = await prisma.product.findMany({ where, select: { id: true } });
    const stock = await prisma.inventory.groupBy({ by: ["productId"], where: { productId: { in: all.map((item) => item.id) }, warehouse: { isActive: true } }, _sum: { availableQty: true } });
    const totals = new Map(stock.map((item) => [item.productId, item._sum.availableQty ?? 0]));
    orderedIds = all.sort((a, b) => (totals.get(b.id) ?? 0) - (totals.get(a.id) ?? 0) || a.id.localeCompare(b.id)).map((item) => item.id);
  }
  const idsForPage = orderedIds?.slice((page - 1) * pageSize, page * pageSize);
  const products = await prisma.product.findMany({
    where: { ...where, ...(idsForPage ? { id: { in: idsForPage } } : {}) },
    select: { id: true, name: true, sku: true, category: true, createdAt: true, imageUrl: true, inventories: { where: { warehouse: { isActive: true } }, select: { availableQty: true, reservedQty: true, warehouse: { select: { name: true } } } } },
    orderBy: sort === "newest" ? [{ createdAt: "desc" }, { id: "asc" }] : sort === "stock" ? [{ id: "asc" }] : [{ name: "asc" }, { id: "asc" }],
    ...(idsForPage ? {} : { skip: (page - 1) * pageSize, take: pageSize }),
  });
  const byId = new Map(products.map((product) => [product.id, product]));
  const data = (idsForPage ? idsForPage.map((id) => byId.get(id)).filter(Boolean) : products).map((product: any) => ({
    id: product.id, name: product.name, sku: product.sku, category: product.category, createdAt: product.createdAt, imageUrl: product.imageUrl,
    availableQty: product.inventories.reduce((sum: number, item: any) => sum + item.availableQty, 0),
    reservedQty: product.inventories.reduce((sum: number, item: any) => sum + item.reservedQty, 0),
    warehouses: [...new Set(product.inventories.map((item: any) => item.warehouse.name))],
  }));
  return { data, pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } };
  });
  return res.status(200).json({ status: "success", data: catalogPage });
});

/** Small assistant lookup: return at most three fully described active products. */
export const getAssistantCategoryProducts = asyncHandler(async (req: Request, res: Response) => {
  const rawCategory = typeof req.query.category === "string" ? req.query.category.trim() : "";
  const category = Object.values(Category).find((value) => value.toLowerCase() === rawCategory.toLowerCase());
  if (!category) return res.status(400).json({ status: "error", message: "A valid product category is required." });

  const products = await prisma.product.findMany({
    where: { category, isActive: true },
    select: {
      id: true, name: true, sku: true, category: true, imageUrl: true,
      inventories: { where: { warehouse: { isActive: true } }, select: { availableQty: true } },
    },
    orderBy: { name: "asc" },
    take: 3,
  });
  const prices = await getCurrentProductPrices(products.map(({ id }) => id));
  const data = products.map(({ inventories, ...product }) => ({
    ...product,
    availableQty: inventories.reduce((sum: number, item: { availableQty: number }) => sum + item.availableQty, 0),
    ...(prices.get(product.id) ?? { price: null, currency: null }),
  }));
  return res.status(200).json({ status: "success", data });
});

/** Search for assistant cards with price and stock included in the same response. */
export const searchAssistantProducts = asyncHandler(async (req: Request, res: Response) => {
  const query = typeof req.query.query === "string" ? req.query.query.trim() : "";
  const rawCategory = typeof req.query.category === "string" ? req.query.category.trim() : "";
  const rawMaxPrice = req.query.maxPrice;
  const inStock = req.query.inStock === "true";
  const category = rawCategory ? Object.values(Category).find((value) => value.toLowerCase() === rawCategory.toLowerCase()) : undefined;
  const maxPrice = rawMaxPrice === undefined ? undefined : Number(rawMaxPrice);
  if (query.length > 200 || (rawCategory && !category) || (rawMaxPrice !== undefined && (!Number.isFinite(maxPrice) || maxPrice! < 0)) || (req.query.inStock !== undefined && !["true", "false"].includes(String(req.query.inStock)))) {
    return res.status(400).json({ status: "error", message: "Invalid assistant product search parameters" });
  }
  const products = await prisma.product.findMany({
    where: {
      isActive: true,
      ...(category ? { category } : {}),
      ...(query ? { OR: [{ name: { contains: query, mode: "insensitive" } }, { sku: { contains: query, mode: "insensitive" } }] } : {}),
      ...(inStock ? { inventories: { some: { warehouse: { isActive: true }, availableQty: { gt: 0 } } } } : {}),
    },
    select: {
      id: true, name: true, sku: true, category: true, imageUrl: true,
      inventories: { where: { warehouse: { isActive: true } }, select: { availableQty: true } },
    },
    orderBy: { name: "asc" },
    take: 30,
  });
  const prices = await getCurrentProductPrices(products.map(({ id }) => id));
  const data = products.map(({ inventories, ...product }) => ({
    ...product, description: null, attributes: {},
    availableQty: inventories.reduce((sum: number, item: { availableQty: number }) => sum + item.availableQty, 0),
    ...(prices.get(product.id) ?? { price: null, currency: null }),
  })).filter((product) => maxPrice === undefined || (product.price !== null && Number(product.price) <= maxPrice));
  return res.status(200).json({ status: "success", data: data.slice(0, 3) });
});

export const getCatalogProducts = asyncHandler(
  async (_req: Request, res: Response) => {
    const catalog = await getOrLoad("available", "catalog", 15, async () => {
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

    return Array.from(catalog.values()).sort((a, b) => b.availableQty - a.availableQty || a.name.localeCompare(b.name));
    });

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

    const products = await getOrLoad(JSON.stringify({ query: searchQuery?.toLowerCase() ?? "", category: validCategory ?? "" }), "products", 15, () => prisma.product.findMany({
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
    }));

    return res.status(200).json({
      status: "success",
      message: "Products searched successfully",
      data: products,
    });
  },
);

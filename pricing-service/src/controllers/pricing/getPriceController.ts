import { Request, Response } from "express";
import prisma from "../../lib/prisma";
import { asyncHandler } from "../../utils/asyncHandler";
import { getOrLoad } from "../../lib/cache";
import {
  historyQuerySchema,
  productParamsSchema,
  setProductPriceSchema,
  updateProductPriceSchema,
} from "../../schemas/priceSchema";

type NumericLike = { toString: () => string } | number | string;

const toNumeric = (value: NumericLike | null) =>
  value === null ? null : Number(value.toString());

export const getProductPrices = asyncHandler(
  async (req: Request, res: Response) => {
    const productIdsParam = req.query.productIds;

    if (!productIdsParam) {
      return res.status(400).json({
        status: "error",
        message: "productIds parameter is required",
      });
    }

    if (typeof productIdsParam !== "string") {
      return res.status(400).json({
        status: "error",
        message: "productIds must be a comma-separated string",
      });
    }

    const productIds = productIdsParam
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);

    if (productIds.length === 0) {
      return res.status(400).json({
        status: "error",
        message: "At least one product ID is required",
      });
    }

    const key = [...new Set(productIds)].sort().join(",");
    const prices = await getOrLoad(key, "prices", 20, () => prisma.productPrice.findMany({
      where: {
        productId: {
          in: [...new Set(productIds)],
        },
      },
      select: { productId: true, price: true, currency: true },
    }));

    return res.status(200).json({
      status: "success",
      data: prices.map((item) => ({
        productId: item.productId,
        price: toNumeric(item.price),
        currency: item.currency,
      })),
    });
  },
);

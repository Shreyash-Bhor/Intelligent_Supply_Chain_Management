import { Request, Response } from "express";
import prisma from "../lib/prisma";
import { asyncHandler } from "../utils/asyncHandler";
import {
  historyQuerySchema,
  productParamsSchema,
  setProductPriceSchema,
  updateProductPriceSchema,
} from "../schemas/priceSchema";

type NumericLike = { toString: () => string } | number | string;

const toNumeric = (value: NumericLike | null) =>
  value === null ? null : Number(value.toString());

export const setProductPrice = asyncHandler(
  async (req: Request, res: Response) => {
    const { productId, price, currency } = setProductPriceSchema.parse(
      req.body,
    );

    const existingPrice = await prisma.productPrice.findUnique({
      where: { productId },
    });

    if (existingPrice) {
      return res.status(409).json({
        status: "error",
        message:
          "Price already exists for this product. Use update endpoint instead.",
      });
    }

    const createdPrice = await prisma.$transaction(async (tx: any) => {
      const productPrice = await tx.productPrice.create({
        data: {
          productId,
          price,
          currency,
        },
      });

      await tx.historicalPrice.create({
        data: {
          productPriceId: productPrice.id,
          productId,
          oldPrice: null,
          newPrice: price,
          currency,
          changeType: "CREATED",
        },
      });

      return productPrice;
    });

    return res.status(201).json({
      status: "success",
      message: "Product price created successfully",
      data: {
        ...createdPrice,
        price: toNumeric(createdPrice.price),
      },
    });
  },
);

export const updateProductPrice = asyncHandler(
  async (req: Request, res: Response) => {
    const { productId } = productParamsSchema.parse(req.params);
    const { price, currency } = updateProductPriceSchema.parse(req.body);

    const updatedPrice = await prisma.$transaction(async (tx: any) => {
      const existingPrice = await tx.productPrice.findUnique({
        where: { productId },
      });

      if (!existingPrice) {
        return null;
      }

      const nextCurrency = currency ?? existingPrice.currency;

      const productPrice = await tx.productPrice.update({
        where: { productId },
        data: {
          price,
          currency: nextCurrency,
        },
      });

      await tx.historicalPrice.create({
        data: {
          productPriceId: productPrice.id,
          productId,
          oldPrice: existingPrice.price,
          newPrice: price,
          currency: nextCurrency,
          changeType: "UPDATED",
        },
      });

      return productPrice;
    });

    if (!updatedPrice) {
      return res.status(404).json({
        status: "error",
        message: "Price not found for the provided product",
      });
    }

    return res.status(200).json({
      status: "success",
      message: "Product price updated successfully",
      data: {
        ...updatedPrice,
        price: toNumeric(updatedPrice.price),
      },
    });
  },
);

export const getProductPrice = asyncHandler(
  async (req: Request, res: Response) => {
    const { productId } = productParamsSchema.parse(req.params);

    const productPrice = await prisma.productPrice.findUnique({
      where: { productId },
    });

    if (!productPrice) {
      return res.status(404).json({
        status: "error",
        message: "Price not found for the provided product",
      });
    }

    return res.status(200).json({
      status: "success",
      data: {
        ...productPrice,
        price: toNumeric(productPrice.price),
      },
    });
  },
);

export const getProductPriceHistory = asyncHandler(
  async (req: Request, res: Response) => {
    const { productId } = productParamsSchema.parse(req.params);
    const { skip, take } = historyQuerySchema.parse(req.query);

    const history = await prisma.historicalPrice.findMany({
      where: { productId },
      orderBy: { changedAt: "desc" },
      skip,
      take,
    });

    return res.status(200).json({
      status: "success",
      data: history.map((entry: any) => ({
        ...entry,
        oldPrice: toNumeric(entry.oldPrice),
        newPrice: toNumeric(entry.newPrice),
      })),
      pagination: {
        skip,
        take,
        count: history.length,
      },
    });
  },
);

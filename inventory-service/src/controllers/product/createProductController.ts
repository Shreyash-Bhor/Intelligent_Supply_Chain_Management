import { createProductSchema } from "../../schemas/productSchema";
import prisma from "../../lib/prisma";
import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";

export const createProduct = asyncHandler(
  async (req: Request, res: Response) => {
    const data = createProductSchema.parse(req.body);
    const { name, sku, imageUrl } = data;
    const result = await prisma.$transaction(async (tx: any) => {
      const existingProduct = await tx.product.findUnique({
        where: { sku },
      });
      if (existingProduct) {
        return null;
      }
      const newProduct = await tx.product.create({
        data: {
          name,
          sku,
          imageUrl,
        },
      });
      return newProduct;
    });
    if (!result) {
      return res
        .status(409)
        .json({ status: "conflict", message: "Product already exists" });
    }

    return res.status(201).json({
      status: "success",
      message: "Product created successfully",
      data: {
        id: result.id,
        name: result.name,
        sku: result.sku,
        imageUrl: result.imageUrl,
      },
    });
  },
);

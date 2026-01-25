import {
  updateProductSchema,
  updateProductStatusSchema,
} from "../../schemas/productSchema";
import prisma from "../../lib/prisma";
import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";

export const updateProduct = asyncHandler(
  async (req: Request, res: Response) => {
    const { productId } = req.params;
    const data = updateProductSchema.parse(req.body);
    const product = await prisma.product.update({
      where: { id: productId },
      data,
    });
    return res.status(200).json({
      status: "success",
      message: "Product updated successfully",
      data: product,
    });
  },
);

export const updateProductStatus = asyncHandler(
  async (req: Request, res: Response) => {
    const { productId } = req.params;
    const data = updateProductStatusSchema.parse(req.body);
    const { isActive } = data;
    const product = await prisma.product.update({
      where: { id: productId },
      data: {
        isActive,
      },
    });
    return res.status(200).json({
      status: "success",
      message: "Product status updated successfully",
      data: product,
    });
  },
);

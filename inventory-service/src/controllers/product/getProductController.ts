import prisma from "../../lib/prisma";
import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";

export const getProduct = asyncHandler(async (req: Request, res: Response) => {
  const { productId } = req.params;
  const product = await prisma.product.findUnique({
    where: { id: productId },
  });
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
    const products = await prisma.product.findMany({
      where: { isActive: true },
    });
    return res.status(200).json({
      status: "success",
      message: "Products fetched successfully",
      data: products,
    });
  },
);

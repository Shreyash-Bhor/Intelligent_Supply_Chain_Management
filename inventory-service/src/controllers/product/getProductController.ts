import { getProductSchema } from "../../schemas/productSchema";
import prisma from "../../lib/prisma";
import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";

export const getProduct = asyncHandler(async (req: Request, res: Response) => {
  const data = getProductSchema.parse(req.body);
  const { sku } = data;
  const product = await prisma.product.findUnique({
    where: { sku },
  });
  if (!product) {
    return res
      .status(404)
      .json({ status: "error", message: "Product not found" });
  }
  return res.status(200).json({
    status: "success",
    message: "Product found successfully",
    productDetails: {
      id: product.id,
      name: product.name,
      sku: product.sku,
    },
  });
});

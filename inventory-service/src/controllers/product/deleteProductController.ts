import { deleteProductSchema } from "../../schemas/productSchema";
import prisma from "../../lib/prisma";
import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";

export const deleteProduct = asyncHandler(
  async (req: Request, res: Response) => {
    const data = deleteProductSchema.parse(req.body);
    const { sku } = data;
    const deletedProduct = await prisma.product.delete({
      where: { sku },
    });
    return res.status(200).json({
      status: "success",
      message: "Product deleted uccessfully",
      data: deletedProduct,
    });
  }
);

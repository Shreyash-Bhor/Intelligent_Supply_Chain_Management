import prisma from "../../lib/prisma";
import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";

export const deleteProduct = asyncHandler(
  async (req: Request, res: Response) => {
    const { productId } = req.params;
    const deletedProduct = await prisma.product.delete({
      where: { id: productId },
    });
    if (!deletedProduct) {
      return res
        .status(404)
        .json({ status: "error", message: "Product not found" });
    }
    return res.status(200).json({
      status: "success",
      message: "Product deleted uccessfully",
      data: deletedProduct,
    });
  },
);

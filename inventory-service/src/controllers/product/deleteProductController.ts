import prisma from "../../lib/prisma";
import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { deletedProductHistorySchema } from "../../schemas/deletedProductHistorySchema";

export const deleteProduct = asyncHandler(
  async (req: Request, res: Response) => {
    const { productId } = req.params;

    if (!productId) {
      return res
        .status(400)
        .json({ status: "error", message: "Product ID is required" });
    }

    const { reason } = deletedProductHistorySchema.parse(req.body);

    const deletedProduct = await prisma.$transaction(async (tx: any) => {
      const product = await tx.product.findUnique({
        where: { id: productId },
      });

      if (!product) return null;

      await tx.productDeletion.create({
        data: {
          productId,
          reason,
        },
      });

      return tx.product.delete({
        where: { id: productId },
      });
    });

    if (!deletedProduct) {
      return res
        .status(404)
        .json({ status: "error", message: "Product not found" });
    }

    return res.status(200).json({
      status: "success",
      message: "Product deleted successfully",
      data: deletedProduct,
    });
  },
);

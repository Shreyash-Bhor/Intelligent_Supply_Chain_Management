import { Router } from "express";
import { createProduct } from "../controllers/product/createProductController";
import { deleteProduct } from "../controllers/product/deleteProductController";
import {
  getAllProducts,
  getProduct,
} from "../controllers/product/getProductController";
import {
  updateProduct,
  updateProductStatus,
} from "../controllers/product/updateProductController";

const router = Router();
router.post("/", createProduct);

router.get("/:productId", getProduct);
router.get("/products", getAllProducts);

router.delete("/:productId", deleteProduct);
router.patch("/:productId", updateProduct);
router.patch("/:productId/status", updateProductStatus);

export default router;

import { Router } from "express";
import { createProduct } from "../controllers/product/createProductController";
import { deleteProduct } from "../controllers/product/deleteProductController";
import {
  getAllProducts,
  getCatalogProducts,
  getProduct,
  getUserDashboardProducts,
} from "../controllers/product/getProductController";
import { requireCustomerAccess } from "../middleware/customerAccess";
import {
  updateProduct,
  updateProductStatus,
} from "../controllers/product/updateProductController";

const router = Router();
router.post("/", createProduct);

router.get("/products", getAllProducts);
router.get("/catalog", getCatalogProducts);
router.get("/user-dashboard", requireCustomerAccess, getUserDashboardProducts);
router.get("/:productId", getProduct);

router.delete("/:productId", deleteProduct);
router.patch("/:productId", updateProduct);
router.patch("/:productId/status", updateProductStatus);

export default router;

import { Router } from "express";
import { createProduct } from "../../controllers/inventory/product/createProductController";
import { deleteProduct } from "../../controllers/inventory/product/deleteProductController";
import {
  getAllProducts,
  getAssistantCategoryProducts,
  getCatalogProducts,
  getPagedUserCatalog,
  getProduct,
  getUserDashboardProducts,
  searchAssistantProducts,
  searchProducts,
} from "../../controllers/inventory/product/getProductController";
import { requireCustomerAccess } from "../../middleware/customerAccess";
import {
  updateProduct,
  updateProductStatus,
} from "../../controllers/inventory/product/updateProductController";

const router = Router();
router.post("/", createProduct);

router.get("/products", getAllProducts);
router.get("/catalog", getCatalogProducts);
router.get("/user-catalog", requireCustomerAccess, getPagedUserCatalog);
router.get("/assistant/category", requireCustomerAccess, getAssistantCategoryProducts);
router.get("/assistant/search", requireCustomerAccess, searchAssistantProducts);
router.get("/search", searchProducts);
router.get("/user-dashboard", requireCustomerAccess, getUserDashboardProducts);
router.get("/:productId", getProduct);

router.delete("/:productId", deleteProduct);
router.patch("/:productId", updateProduct);
router.patch("/:productId/status", updateProductStatus);

export default router;

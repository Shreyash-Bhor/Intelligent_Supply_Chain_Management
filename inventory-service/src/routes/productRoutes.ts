import { Router } from "express";
import { addProduct } from "../controllers/product/addProductController";
import { deleteProduct } from "../controllers/product/deleteProductController";
import { getProduct } from "../controllers/product/getProductController";

const router = Router();
router.post("/add", addProduct);
router.post("/delete", deleteProduct);
router.get("/get", getProduct);

export default router;

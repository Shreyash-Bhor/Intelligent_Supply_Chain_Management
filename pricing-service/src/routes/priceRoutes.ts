import { Router } from "express";
import {
  getProductPrice,
  getProductPriceHistory,
  setProductPrice,
  updateProductPrice,
} from "../controllers/priceController";

const priceRouter = Router();

priceRouter.post("/", setProductPrice);
priceRouter.patch("/:productId", updateProductPrice);
priceRouter.get("/:productId", getProductPrice);
priceRouter.get("/:productId/history", getProductPriceHistory);

export default priceRouter;

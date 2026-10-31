import { Router } from "express";
import {
  getProductPrice,
  getProductPriceHistory,
  setProductPrice,
  updateProductPrice,
} from "../../controllers/pricing/priceController";
import { getProductPrices } from "../../controllers/pricing/getPriceController";

const priceRouter = Router();

priceRouter.post("/", setProductPrice);
priceRouter.get("/", getProductPrices);
priceRouter.patch("/:productId", updateProductPrice);
priceRouter.get("/:productId", getProductPrice);
priceRouter.get("/:productId/history", getProductPriceHistory);

export default priceRouter;

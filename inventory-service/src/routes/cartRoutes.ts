import { Router } from "express";
import { clearCart, getCart, removeCartItem, setCartItem } from "../controllers/cartController";

const router = Router();
router.get("/", getCart);
router.put("/items", setCartItem);
router.delete("/items/:productId", removeCartItem);
router.delete("/", clearCart);
export default router;

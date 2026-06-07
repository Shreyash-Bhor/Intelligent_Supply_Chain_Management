import { Router } from "express";
import { createOrder } from "../controllers/order/createOrderController";
import { getCustomerOrders } from "../controllers/order/getOrderController";
const router = Router();
router.post("/", createOrder);
router.get("/", getCustomerOrders);
export default router;

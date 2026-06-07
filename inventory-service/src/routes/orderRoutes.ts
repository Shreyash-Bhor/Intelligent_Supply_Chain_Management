import { Router } from "express";
import {
  createOrder,
  getCustomerOrders,
} from "../controllers/order/orderController";
const router = Router();
router.post("/", createOrder);
router.get("/", getCustomerOrders);
export default router;

import { Router } from "express";
import {
  loginCustomer,
  registerCustomer,
} from "../controllers/auth/customerAuthController";
const router = Router();
router.post("/register", registerCustomer);
router.post("/login", loginCustomer);
export default router;

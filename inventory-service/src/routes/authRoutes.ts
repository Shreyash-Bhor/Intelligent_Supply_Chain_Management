import { Router } from "express";
import { getCustomerProfile, loginCustomer } from "../controllers/auth/loginAuthController";
import { registerCustomer } from "../controllers/auth/registerAuthController";
const router = Router();
router.post("/register", registerCustomer);
router.post("/login", loginCustomer);
router.get("/me", getCustomerProfile);
export default router;

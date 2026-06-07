import { Router } from "express";
import { loginCustomer } from "../controllers/auth/loginAuthController";
import { registerCustomer } from "../controllers/auth/registerAuthController";
const router = Router();
router.post("/register", registerCustomer);
router.post("/login", loginCustomer);
export default router;

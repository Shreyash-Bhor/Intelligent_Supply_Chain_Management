import { Router } from "express";
import { createWarehouse } from "../controllers/warehouse/createWarehouseController";

const router = Router();
router.post("/create", createWarehouse);

export default router;

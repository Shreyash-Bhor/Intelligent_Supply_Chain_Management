import { Router } from "express";
import { createInventory } from "../controllers/inventory/createInventoryController";

const router = Router();
router.post("/create", createInventory);

export default router;

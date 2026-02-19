import { Router } from "express";
import { createInventory } from "../controllers/inventory/createInventoryController";
import { createReorder } from "../controllers/reorder/createReorderController";
import {
  getAllInventory,
  getInventoryDetails,
} from "../controllers/inventory/getInventoryController";
import {
  updateInventory,
  updateInventoryStatus,
} from "../controllers/inventory/updateInventoryController";

const router = Router();

// Inventory CRUD
router.post("/", createInventory);
router.get("/", getAllInventory);
router.get("/:inventoryId", getInventoryDetails);
router.patch("/:inventoryId", updateInventory);

// Reorder from inventory
router.post("/:inventoryId/reorder", createReorder);

export default router;

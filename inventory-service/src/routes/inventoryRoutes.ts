import { Router } from "express";
import { createInventory } from "../controllers/inventory/createInventoryController";
import { getInventoryDetails } from "../controllers/inventory/getInventoryController";
import {
  updateInventory,
  updateInventoryStatus,
} from "../controllers/inventory/updateInventoryController";

const router = Router();
router.post("/", createInventory);

router.get("/:inventoryId", getInventoryDetails);

router.patch("/:inventoryId", updateInventory);
router.patch("/:inventoryId/status", updateInventoryStatus);

export default router;

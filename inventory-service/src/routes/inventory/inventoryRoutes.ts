import { Router } from "express";
import { createInventory } from "../../controllers/inventory/stock/createInventoryController";
import { createReorder } from "../../controllers/inventory/reorder/createReorderController";
import {
  getAllInventory,
  getInventoryDetails,
} from "../../controllers/inventory/stock/getInventoryController";
import {
  updateInventory,
} from "../../controllers/inventory/stock/updateInventoryController";
import { getProductAvailability } from "../../controllers/inventory/stock/getInventoryController";
import { requireWarehouseManagerAccess } from "../../middleware/warehouseManagerAccess";

const router = Router();

// Inventory CRUD
// Product availability is safe to expose to the customer assistant; keep
// inventory administration routes restricted to warehouse managers.
router.get("/product/:productId", getProductAvailability);
router.use(requireWarehouseManagerAccess);
router.post("/", createInventory);
router.get("/", getAllInventory);
router.get("/:inventoryId", getInventoryDetails);
router.patch("/:inventoryId", updateInventory);

// Reorder from inventory
router.post("/:inventoryId/reorder", createReorder);

export default router;

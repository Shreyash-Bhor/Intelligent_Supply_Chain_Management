import { Router } from "express";
import { createWarehouse } from "../../controllers/inventory/warehouse/createWarehouseController";
import {
  updateWarehouse,
  updateWarehouseStatus,
} from "../../controllers/inventory/warehouse/updateWarehouseController";
import {
  getWarehouseData,
  getWarehouses,
} from "../../controllers/inventory/warehouse/getWarehouseController";

const router = Router();
router.post("/", createWarehouse);

router.get("/warehouses", getWarehouses);
router.get("/:warehouseId", getWarehouseData);

router.patch("/:warehouseId", updateWarehouse);
router.patch("/:warehouseId/status", updateWarehouseStatus);
export default router;

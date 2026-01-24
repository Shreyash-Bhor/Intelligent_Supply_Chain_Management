import { Router } from "express";
import { createWarehouse } from "../controllers/warehouse/createWarehouseController";
import {
  updateWarehouse,
  updateWarehouseStatus,
} from "../controllers/warehouse/updateWarehouseController";
import {
  getWarehouseData,
  getWarehouses,
} from "../controllers/warehouse/getWarehouseController";

const router = Router();
router.post("/", createWarehouse);

router.get("/warehouses", getWarehouses);
router.get("/:warehouseId", getWarehouseData);

router.patch("/:warehouseId", updateWarehouse);
router.patch("/:warehouseId/status", updateWarehouseStatus);
export default router;

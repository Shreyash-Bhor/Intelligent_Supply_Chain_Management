import { Router } from "express";
import { updateReorderStatus } from "../../controllers/inventory/reorder/updateReorderController";
import { getReorderDetails } from "../../controllers/inventory/reorder/getReorderController";
import { requireWarehouseManagerAccess } from "../../middleware/warehouseManagerAccess";

const router = Router();
router.use(requireWarehouseManagerAccess);
router.get("/", getReorderDetails);
router.patch("/:reorderId/status", updateReorderStatus);
export default router;

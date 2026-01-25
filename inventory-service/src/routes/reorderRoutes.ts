import { Router } from "express";
import { createReorder } from "../controllers/reorder/createReorderController";
import { getReorderDetails } from "../controllers/reorder/getReorderController";
import { updateReorderStatus } from "../controllers/reorder/updateReorderController";

const router = Router();

router.post("/", createReorder);
router.get("/details", getReorderDetails);
router.patch("/:orderId/status", updateReorderStatus);

export default router;

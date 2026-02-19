import { Router } from "express";
import { updateReorderStatus } from "../controllers/reorder/updateReorderController";
import { getReorderDetails } from "../controllers/reorder/getReorderController";

const router = Router();
router.get("/", getReorderDetails);
router.patch("/:reorderId/status", updateReorderStatus);
export default router;

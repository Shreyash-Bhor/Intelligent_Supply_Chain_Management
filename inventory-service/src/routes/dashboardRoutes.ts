import { Router } from "express";
import { getDashboardSummary } from "../controllers/dashboard/getDashboardSummary";

const router = Router();

router.get("/summary", getDashboardSummary);

export default router;

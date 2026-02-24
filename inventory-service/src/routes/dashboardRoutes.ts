import { Router } from "express";
import { getDashboardSummary } from "../controllers/dashboard/getDashboardSummary";

const router = Router();

router.get("/summary", getDashboardSummary);

router.get("/access", (req, res) => {
  return res.status(200).json({
    status: "success",
    message: "Warehouse manager authenticated",
    data: {
      email: res.locals.manager?.email,
      authenticatedAt: new Date().toISOString(),
    },
  });
});

export default router;

import { Router } from "express";
import { getDashboardSummary } from "../../controllers/general/dashboard/getDashboardSummary";
import { getManagerOrderAnalytics, getManagerOrders } from "../../controllers/general/order/managerOrdersController";

const router = Router();

router.get("/summary", getDashboardSummary);
router.get("/orders/analytics", getManagerOrderAnalytics);
router.get("/orders", getManagerOrders);

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

import express from "express";
import { Request, Response } from "express";
import prisma from "./lib/prisma";
import dotenv from "dotenv";
import productRoutes from "./routes/inventory/productRoutes";
import inventoryRoutes from "./routes/inventory/inventoryRoutes";
import warehouseRoutes from "./routes/inventory/warehouseRoutes";
import reorderRoutes from "./routes/inventory/reorderRoutes";
import dashboardRoutes from "./routes/general/dashboardRoutes";
import authRoutes from "./routes/general/authRoutes";
import orderRoutes from "./routes/general/orderRoutes";
import cartRoutes from "./routes/general/cartRoutes";
import addressRoutes from "./routes/general/addressRoutes";
import assistantRoutes from "./routes/general/assistantRoutes";
import { requireCustomerAccess } from "./middleware/customerAccess";
import { consumeAssistantRateLimit } from "./controllers/general/assistantController";
import { requireWarehouseManagerAccess } from "./middleware/warehouseManagerAccess";
import cors from "cors";
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json());
app.use(cors());
app.use((req, res, next) => {
  const startedAt = process.hrtime.bigint();
  res.on("finish", () => {
    console.info(JSON.stringify({
      event: "http_request_complete",
      service: "inventory",
      method: req.method,
      route: req.route?.path ?? req.path,
      status: res.statusCode,
      durationMs: Number(process.hrtime.bigint() - startedAt) / 1_000_000,
    }));
  });
  next();
});
app.use("/api/auth", authRoutes);
app.use("/api/orders", requireCustomerAccess, orderRoutes);
app.use("/api/cart", requireCustomerAccess, cartRoutes);
app.use("/api/addresses", requireCustomerAccess, addressRoutes);
app.post("/api/assistant/rate-limit", (req, res, next) => {
  const authHeader = req.header("authorization");
  if (authHeader?.startsWith("Bearer ")) return requireCustomerAccess(req, res, next);
  return next();
}, consumeAssistantRateLimit);
app.use("/api/assistant", requireCustomerAccess, assistantRoutes);
app.use("/api/product", productRoutes);
app.use("/api/inventory", inventoryRoutes);
app.use("/warehouse", warehouseRoutes);
app.use("/api/reorder", reorderRoutes);
app.use("/dashboard", requireWarehouseManagerAccess, dashboardRoutes);

app.get("/health", async (req: Request, res: Response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return res.status(200).json({
      status: "ok",
      database: "connected",
    });
  } catch (error) {
    return res.status(500).json({
      status: "error",
      database: "disconnected",
    });
  }
});

async function startServer() {
  const server = app.listen(PORT, () => {
    console.log(`Server running on port : ${PORT}`);
  });
  server.on("error", (error) => {
    console.error("Inventory service failed to bind its HTTP port:", error);
    process.exitCode = 1;
  });

  void prisma.$connect().then(() => {
    console.log("Database Connected");
  }).catch((error) => {
    console.warn("Database is unavailable; inventory service remains online and will connect on demand.", error instanceof Error ? error.message : error);
  });
}

startServer();

const shutdown = async () => {
  console.log("Shutting down server...");
  await prisma.$disconnect();
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

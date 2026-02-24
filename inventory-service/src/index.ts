import express from "express";
import { Request, Response } from "express";
import prisma from "./lib/prisma";
import dotenv from "dotenv";
import authRoutes from "./routes/authRoutes";
import productRoutes from "./routes/productRoutes";
import inventoryRoutes from "./routes/inventoryRoutes";
import warehouseRoutes from "./routes/warehouseRoutes";
import reorderRoutes from "./routes/reorderRoutes";
import dashboardRoutes from "./routes/dashboardRoutes";
import { requireWarehouseManagerAccess } from "./middleware/warehouseManagerAccess";
import cors from "cors";
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json());
app.use(cors());
app.use("/api", authRoutes);
app.use("/api/product", productRoutes);
app.use("/api/inventory", requireWarehouseManagerAccess, inventoryRoutes);
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
  try {
    await prisma.$connect();
    console.log("Database Connected");
  } catch (error) {
    console.warn("Database connection unavailable. Starting in fallback mode.");
  }

  app.listen(PORT, () => {
    console.log(`Server running on port : ${PORT}`);
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

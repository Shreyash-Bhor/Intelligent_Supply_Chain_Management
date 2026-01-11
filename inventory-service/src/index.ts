import express from "express";
import { Request, Response } from "express";
import prisma from "./lib/prisma";
import dotenv from "dotenv";
import productRoutes from "./routes/productRoutes";
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use("/api/product", productRoutes);

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

    app.listen(PORT, () => {
      console.log(`Server running on port : ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to connect to database", error);
    process.exit(1);
  }
}

startServer();

const shutdown = async () => {
  console.log("Shutting down server...");
  await prisma.$disconnect();
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

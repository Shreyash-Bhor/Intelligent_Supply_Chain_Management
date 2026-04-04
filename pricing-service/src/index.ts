import express, { NextFunction, Request, Response } from "express";
import dotenv from "dotenv";
import cors from "cors";
import { ZodError } from "zod";
import prisma from "./lib/prisma";
import priceRouter from "./routes/priceRoutes";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5555;

app.use(express.json());
app.use(cors());

app.get("/health", async (_req: Request, res: Response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return res.status(200).json({
      status: "ok",
      database: "connected",
    });
  } catch (_error) {
    return res.status(500).json({
      status: "error",
      database: "disconnected",
    });
  }
});

app.use("/api/prices", priceRouter);

app.use((_req: Request, res: Response) => {
  return res.status(404).json({
    status: "error",
    message: "Route not found",
  });
});

app.use((error: Error, _req: Request, res: Response, _next: NextFunction) => {
  if (error instanceof ZodError) {
    return res.status(400).json({
      status: "error",
      message: "Validation failed",
      issues: error.issues,
    });
  }

  return res.status(500).json({
    status: "error",
    message: error.message || "Internal Server Error",
  });
});

async function startServer() {
  try {
    await prisma.$connect();
    console.log("Database Connected");
  } catch (_error) {
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

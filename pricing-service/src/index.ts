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
app.use((req, res, next) => {
  const startedAt = process.hrtime.bigint();
  res.on("finish", () => {
    console.info(JSON.stringify({
      event: "http_request_complete",
      service: "pricing",
      method: req.method,
      route: req.route?.path ?? req.path,
      status: res.statusCode,
      durationMs: Number(process.hrtime.bigint() - startedAt) / 1_000_000,
    }));
  });
  next();
});

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
  const server = app.listen(PORT, () => {
    console.log(`Server running on port : ${PORT}`);
  });
  server.on("error", (error) => {
    console.error("Pricing service failed to bind its HTTP port:", error);
    process.exitCode = 1;
  });

  void prisma.$connect().then(() => {
    console.log("Database Connected");
  }).catch((error) => {
    console.warn("Database is unavailable; pricing service remains online and will connect on demand.", error instanceof Error ? error.message : error);
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

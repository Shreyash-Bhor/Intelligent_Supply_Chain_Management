import { Request, Response } from "express";
import { ZodError } from "zod";

export const asyncHandler =
  (fn: (req: Request, res: Response) => Promise<any>) =>
  async (req: Request, res: Response) => {
    try {
      await fn(req, res);
    } catch (error: unknown) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          status: "error",
          message: "Validation failed",
          issues: error.issues,
        });
      }
      if (typeof error === "object" && error !== null && "statusCode" in error && Number((error as { statusCode: unknown }).statusCode) === 409) {
        return res.status(409).json({ status: "error", message: error instanceof Error ? error.message : "Request conflict" });
      }
      const statusCode = typeof error === "object" && error !== null && "statusCode" in error
        ? Number((error as { statusCode: unknown }).statusCode)
        : 500;
      const safeStatus = Number.isInteger(statusCode) && statusCode >= 400 && statusCode <= 599 ? statusCode : 500;
      return res.status(safeStatus).json({
        status: "error",
        message: safeStatus === 500 ? "Internal Server Error" : error instanceof Error ? error.message : "Request failed",
      });
    }
  };

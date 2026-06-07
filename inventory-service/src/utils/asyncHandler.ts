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
      return res.status(500).json({
        status: "error",
        message:
          error instanceof Error ? error.message : "Internal Server Error",
      });
    }
  };

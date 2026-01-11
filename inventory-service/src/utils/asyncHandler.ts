import { Request, Response } from "express";

export const asyncHandler =
  (fn: (req: Request, res: Response) => Promise<any>) =>
  async (req: Request, res: Response) => {
    try {
      await fn(req, res);
    } catch (error: any) {
      return res.status(500).json({
        status: "error",
        message: error.message || "Internal Server Error",
      });
    }
  };

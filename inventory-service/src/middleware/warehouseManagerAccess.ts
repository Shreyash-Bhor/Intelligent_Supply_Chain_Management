import { Request, Response, NextFunction } from "express";

const normalized = (value?: string) => value?.trim().toLowerCase() ?? "";

export function requireWarehouseManagerAccess(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const expectedKey = process.env.WAREHOUSE_MANAGER_ACCESS_KEY;
  const expectedEmail = process.env.WAREHOUSE_MANAGER_EMAIL;

  if (!expectedKey || !expectedEmail) {
    return res.status(500).json({
      status: "error",
      message:
        "Warehouse manager access is not configured. Please set WAREHOUSE_MANAGER_EMAIL and WAREHOUSE_MANAGER_ACCESS_KEY.",
    });
  }

  const accessKey = req.header("x-manager-access-key");
  const email = req.header("x-manager-email");

  if (!accessKey || !email) {
    return res.status(401).json({
      status: "unauthorized",
      message: "Warehouse manager credentials are required.",
    });
  }

  if (
    accessKey !== expectedKey ||
    normalized(email) !== normalized(expectedEmail)
  ) {
    return res.status(403).json({
      status: "forbidden",
      message: "Only the configured warehouse manager can access this data.",
    });
  }

  res.locals.manager = {
    email: normalized(expectedEmail),
  };

  next();
}

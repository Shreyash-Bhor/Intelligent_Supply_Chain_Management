import { NextFunction, Request, Response } from "express";
import { verifyCustomerToken } from "../services/customerToken";

export function requireCustomerAccess(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const authorization = req.header("authorization");
  const token = authorization?.startsWith("Bearer ")
    ? authorization.slice(7)
    : null;

  if (!token) {
    return res.status(401).json({
      status: "unauthorized",
      message: "Customer authentication is required.",
    });
  }

  try {
    const customer = verifyCustomerToken(token);
    if (!customer) {
      return res.status(401).json({
        status: "unauthorized",
        message: "Customer session is invalid or expired.",
      });
    }
    res.locals.customer = customer;
    next();
  } catch (error) {
    return res.status(500).json({
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "Authentication is unavailable.",
    });
  }
}

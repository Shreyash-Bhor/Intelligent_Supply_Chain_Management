import bcrypt from "bcrypt";
import { Request, Response } from "express";
import prisma from "../../lib/prisma";
import { loginSchema, registerSchema } from "../../schemas/authSchema";
import { createCustomerToken } from "../../services/customerToken";
import { asyncHandler } from "../../utils/asyncHandler";

const sessionData = (user: { id: string; name: string; email: string }) => ({
  token: createCustomerToken(user.id, user.email),
  user: {
    id: user.id,
    name: user.name,
    email: user.email,
    role: "user" as const,
  },
});

export const registerCustomer = asyncHandler(
  async (req: Request, res: Response) => {
    const input = registerSchema.parse(req.body);
    const existing = await prisma.user.findUnique({
      where: { email: input.email },
    });
    if (existing)
      return res.status(409).json({
        status: "error",
        message: "User already exists. Please login instead.",
      });

    const user = await prisma.user.create({
      data: {
        name: input.name,
        email: input.email,
        password: await bcrypt.hash(input.password, 12),
        isEmailVerified: true,
      },
      select: { id: true, name: true, email: true },
    });
    return res.status(201).json({
      status: "success",
      message: "Account created successfully",
      data: sessionData(user),
    });
  },
);

export const loginCustomer = asyncHandler(
  async (req: Request, res: Response) => {
    const input = loginSchema.parse(req.body);
    const user = await prisma.user.findUnique({
      where: { email: input.email },
    });
    if (
      !user ||
      !user.isActive ||
      !(await bcrypt.compare(input.password, user.password))
    ) {
      return res
        .status(401)
        .json({ status: "error", message: "Invalid email or password." });
    }
    return res.status(200).json({ status: "success", data: sessionData(user) });
  },
);

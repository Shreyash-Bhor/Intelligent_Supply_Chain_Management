import bcrypt from "bcrypt";
import { Request, Response } from "express";
import prisma from "../../lib/prisma";
import { registerSchema } from "../../schemas/authSchema";
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

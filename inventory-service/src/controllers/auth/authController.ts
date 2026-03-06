import { Request, Response } from "express";
import prisma from "../../lib/prisma";
import { asyncHandler } from "../../utils/asyncHandler";
import { hashPassword, verifyHash } from "../../utils/password";
import { authSchema } from "../../schemas/authSchema";

export const signup = asyncHandler(async (req: Request, res: Response) => {
  const data = authSchema.parse(req.body);
  const { email, password } = data;

  const result = await prisma.$transaction(async (tx) => {
    const existingUser = await tx.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return null;
    }

    const hashedPassword = await hashPassword(password);

    const newUser = await tx.user.create({
      data: {
        email,
        password: hashedPassword,
      },
    });

    return newUser;
  });

  if (!result) {
    return res
      .status(409)
      .json({ status: "conflict", message: "User already exists!" });
  }

  return res.status(201).json({
    status: "success",
    message: "User Registered Successfully",
    newUser: {
      id: result.id,
      email: result.email,
      isEmailVerified: result.isEmailVerified,
      isActive: result.isActive,
      createdAt: result.createdAt,
      updatedAt: result.updatedAt,
    },
  });
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const data = authSchema.parse(req.body);
  const { email, password } = data;

  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user || !(await verifyHash(password, user.password))) {
    return res.status(401).json({
      status: "unauthorized",
      message: "Email or password does not match",
    });
  }

  if (!user.isActive) {
    return res.status(403).json({
      status: "forbidden",
      message: "Your account is deactivated. Please contact support.",
    });
  }

  if (!user.isEmailVerified) {
    return res.status(403).json({
      status: "forbidden",
      message: "Please verify your email before logging in.",
    });
  }

  return res.status(200).json({
    status: "success",
    message: "Login Successfull",
    user: {
      id: user.id,
      email: user.email,
      isEmailVerified: user.isEmailVerified,
      isActive: user.isActive,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    },
  });
});

import { Request, Response } from "express";
import prisma from "../lib/prisma";
import { addressSchema } from "../schemas/addressSchema";
import { asyncHandler } from "../utils/asyncHandler";

export const listAddresses = asyncHandler(
  async (_req: Request, res: Response) => {
    const data = await prisma.address.findMany({
      where: { userId: res.locals.customer.sub },
      orderBy: { updatedAt: "desc" },
    });
    return res.status(200).json({ status: "success", data });
  },
);

export const createAddress = asyncHandler(
  async (req: Request, res: Response) => {
    const input = addressSchema.parse(req.body);
    const data = await prisma.address.create({
      data: { ...input, userId: res.locals.customer.sub },
    });
    return res.status(201).json({ status: "success", data });
  },
);

export const updateAddress = asyncHandler(
  async (req: Request, res: Response) => {
    const input = addressSchema.parse(req.body);
    const result = await prisma.address.updateMany({
      where: { id: req.params.addressId, userId: res.locals.customer.sub },
      data: input,
    });
    if (!result.count)
      return res.status(404).json({ status: "error", message: "Address not found" });
    const data = await prisma.address.findFirst({
      where: { id: req.params.addressId, userId: res.locals.customer.sub },
    });
    return res.status(200).json({ status: "success", data });
  },
);

export const deleteAddress = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await prisma.address.deleteMany({
      where: { id: req.params.addressId, userId: res.locals.customer.sub },
    });
    if (!result.count)
      return res
        .status(404)
        .json({ status: "error", message: "Address not found" });
    return res.status(204).send();
  },
);

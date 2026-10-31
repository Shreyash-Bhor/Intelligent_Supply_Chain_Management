import { Request, Response } from "express";
import prisma from "../lib/prisma";
import { addressSchema } from "../schemas/addressSchema";
import { asyncHandler } from "../utils/asyncHandler";

const publicAddress = (address: any) => ({ id: address.id, name: address.name, phone: address.phone, address1: address.address1, address2: address.address2, city: address.city, region: address.region, postalCode: address.postalCode, country: address.country, isDefault: address.isDefault, createdAt: address.createdAt, updatedAt: address.updatedAt });

export const listAddresses = asyncHandler(
  async (_req: Request, res: Response) => {
    const data = await prisma.address.findMany({
      where: { userId: res.locals.customer.sub },
      select: { id: true, name: true, phone: true, address1: true, address2: true, city: true, region: true, postalCode: true, country: true, isDefault: true, createdAt: true, updatedAt: true },
      orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
    });
    return res.status(200).json({ status: "success", data });
  },
);

export const createAddress = asyncHandler(
  async (req: Request, res: Response) => {
    const input = addressSchema.parse(req.body);
    const idempotencyKey = req.header("Idempotency-Key");
    if (idempotencyKey && !/^[A-Za-z0-9_-]{16,128}$/.test(idempotencyKey))
      return res.status(400).json({ status: "error", message: "Invalid address submission key." });
    if (idempotencyKey) {
      const existing = await prisma.address.findUnique({ where: { userId_idempotencyKey: { userId: res.locals.customer.sub, idempotencyKey } } });
      if (existing) return res.status(200).json({ status: "success", data: publicAddress(existing) });
    }
    const userId = res.locals.customer.sub as string;
    const shouldBeDefault = input.isDefault ?? (await prisma.address.count({ where: { userId } })) === 0;
    let data;
    try {
      data = await prisma.$transaction(async (tx: any) => {
        if (shouldBeDefault) await tx.address.updateMany({ where: { userId }, data: { isDefault: false } });
        return tx.address.create({ data: { ...input, isDefault: shouldBeDefault, userId, ...(idempotencyKey ? { idempotencyKey } : {}) } });
      }, { isolationLevel: "Serializable" });
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (idempotencyKey && code === "P2002") {
        const replay = await prisma.address.findUnique({ where: { userId_idempotencyKey: { userId, idempotencyKey } } });
        if (replay) return res.status(200).json({ status: "success", data: publicAddress(replay) });
      }
      if (code === "P2002" || code === "P2034") return res.status(409).json({ status: "error", message: "The saved address list changed. Refresh it and retry." });
      throw error;
    }
    return res.status(201).json({ status: "success", data: publicAddress(data) });
  },
);

export const setDefaultAddress = asyncHandler(async (req: Request, res: Response) => {
  const userId = res.locals.customer.sub as string;
  const addressId = req.params.addressId;
  if (!addressId) return res.status(400).json({ status: "error", message: "Address identifier is required." });
  const address = await prisma.address.findFirst({ where: { id: addressId, userId }, select: { id: true } });
  if (!address) return res.status(404).json({ status: "error", message: "Address not found" });
  await setDefaultRecord(userId, addressId);
  const data = await prisma.address.findFirst({ where: { id: addressId, userId } });
  return res.status(200).json({ status: "success", data: data ? publicAddress(data) : null });
});

export const updateAddress = asyncHandler(
  async (req: Request, res: Response) => {
    const input = addressSchema.parse(req.body);
    const addressData = { name: input.name, phone: input.phone, address1: input.address1, address2: input.address2, city: input.city, region: input.region, postalCode: input.postalCode, country: input.country };
    const result = await prisma.address.updateMany({
      where: { id: req.params.addressId, userId: res.locals.customer.sub },
      data: addressData,
    });
    if (!result.count)
      return res.status(404).json({ status: "error", message: "Address not found" });
    const data = await prisma.address.findFirst({
      where: { id: req.params.addressId, userId: res.locals.customer.sub },
    });
    return res.status(200).json({ status: "success", data: data ? publicAddress(data) : null });
  },
);

export const deleteAddress = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = res.locals.customer.sub as string;
    const result = await prisma.$transaction(async (tx: any) => {
      const existing = await tx.address.findFirst({ where: { id: req.params.addressId, userId }, select: { isDefault: true } });
      if (!existing) return { count: 0 };
      await tx.address.deleteMany({ where: { id: req.params.addressId, userId } });
      if (existing.isDefault) {
        const nextDefault = await tx.address.findFirst({ where: { userId }, orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }] });
        if (nextDefault) await tx.address.updateMany({ where: { id: nextDefault.id, userId }, data: { isDefault: true } });
      }
      return { count: 1 };
    });
    if (!result.count)
      return res
        .status(404)
        .json({ status: "error", message: "Address not found" });
    return res.status(204).send();
  },
);

async function setDefaultRecord(userId: string, addressId: string) {
  return prisma.$transaction([
    prisma.address.updateMany({ where: { userId }, data: { isDefault: false } }),
    prisma.address.updateMany({ where: { id: addressId, userId }, data: { isDefault: true } }),
  ]);
}

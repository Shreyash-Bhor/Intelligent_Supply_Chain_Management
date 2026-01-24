import { z } from "zod";

export const createWarehouseSchema = z.object({
  name: z.string().min(1),
  city: z.string().min(1),
  pincode: z.string().max(6),
});

export const updateWarehouseStatusSchema = z.object({
  isActive: z.boolean(),
});

export const updateWarehouseSchema = createWarehouseSchema.partial();

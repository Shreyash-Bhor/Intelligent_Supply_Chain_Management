import { z } from "zod";

export const createStockReorderSchema = z.object({
  requestedQty: z.number().int().positive(),
});

export const updateStockReorderStatusSchema = z.object({
  status: z.enum(["COMPLETED", "CANCELLED"]),
});

export const getStockReorderDetailsSchema = z.object({
  status: z.enum(["PENDING", "COMPLETED", "CANCELLED"]),
});

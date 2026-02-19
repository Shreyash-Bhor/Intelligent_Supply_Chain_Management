import { z } from "zod";

export const createStockReorderSchema = z.object({
  requestedQty: z
    .number()
    .int("Requested quantity must be an integer")
    .positive("Requested quantity must be greater than 0"),
});

export const updateReorderStatusSchema = z.object({
  status: z.enum(["COMPLETED", "CANCELLED"]),
});

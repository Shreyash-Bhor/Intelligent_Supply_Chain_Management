import { z } from "zod";

export const createProductSchema = z.object({
  name: z.string(),
  sku: z.string(),
});

export const updateProductSchema = createProductSchema.partial();

export const updateProductStatusSchema = z.object({
  isActive: z.boolean(),
});

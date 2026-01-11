import { z } from "zod";

export const productSchema = z.object({
  name: z.string(),
  sku: z.string(),
});
export const getProductSchema = z.object({
  sku: z.string(),
});

export const deleteProductSchema = z.object({
  sku: z.string(),
});

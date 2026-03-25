import { z } from "zod";

const imageUrlSchema = z
  .string()
  .trim()
  .url()
  .optional()
  .or(z.literal(""))
  .transform((value) => value || undefined);

export const createProductSchema = z.object({
  name: z.string(),
  sku: z.string(),
  imageUrl: imageUrlSchema,
});

export const updateProductSchema = z.object({
  name: z.string().optional(),
  sku: z.string().optional(),
  imageUrl: imageUrlSchema,
});

export const updateProductStatusSchema = z.object({
  isActive: z.boolean(),
});

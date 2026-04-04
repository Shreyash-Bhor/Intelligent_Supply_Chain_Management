import { z } from "zod";

const normalizedCurrencyCode = z
  .string()
  .trim()
  .length(3, "Currency code must be a 3-letter ISO code")
  .transform((value) => value.toUpperCase());

const normalizedPrice = z
  .number()
  .positive("Price must be greater than 0")
  .multipleOf(0.01, "Price must have at most 2 decimal places");

export const setProductPriceSchema = z.object({
  productId: z.string().trim().min(1, "Product id is required"),
  price: normalizedPrice,
  currency: normalizedCurrencyCode.default("USD"),
});

export const updateProductPriceSchema = z.object({
  price: normalizedPrice,
  currency: normalizedCurrencyCode.optional(),
});

export const productParamsSchema = z.object({
  productId: z.string().trim().min(1, "Product id is required"),
});

export const historyQuerySchema = z.object({
  take: z.coerce.number().int().min(1).max(200).default(50),
  skip: z.coerce.number().int().min(0).default(0),
});

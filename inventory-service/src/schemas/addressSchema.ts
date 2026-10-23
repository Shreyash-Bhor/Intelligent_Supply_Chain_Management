import { z } from "zod";

export const addressSchema = z.object({
  name: z.string().trim().min(2).max(100),
  phone: z.string().trim().regex(/^\+?[0-9 ()-]{7,20}$/),
  address1: z.string().trim().min(4).max(160),
  address2: z.string().trim().max(160).optional().nullable(),
  city: z.string().trim().min(2).max(100),
  region: z.string().trim().min(2).max(100),
  postalCode: z.string().trim().regex(/^[A-Za-z0-9 -]{3,12}$/),
  country: z.string().trim().length(2).transform((value) => value.toUpperCase()).optional().nullable(),
  isDefault: z.boolean().optional(),
});

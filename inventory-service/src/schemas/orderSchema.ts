import { z } from "zod";

export const createOrderSchema = z.object({
  productId: z.string().uuid("A valid product id is required"),
  quantity: z.number().int().min(1).max(100000),
});

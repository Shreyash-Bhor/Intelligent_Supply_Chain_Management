import { z } from "zod";

export const checkoutQuoteSchema = z.object({ addressId: z.string().uuid() });
export const checkoutSchema = z.object({
  addressId: z.string().uuid(),
  quoteToken: z.string().min(20).max(2048),
});

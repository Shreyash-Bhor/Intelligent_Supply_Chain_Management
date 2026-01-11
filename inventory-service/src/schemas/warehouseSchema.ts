import { z } from "zod";

export const warehouseSchema = z.object({
  name: z.string(),
  location: z.string(),
  isActive: z.boolean().default(true),
});

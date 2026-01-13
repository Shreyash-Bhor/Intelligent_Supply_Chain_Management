import { z } from "zod";

export const warehouseSchema = z.object({
  name: z.string(),
  location: z.string(),
});

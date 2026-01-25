import { z } from "zod";

export const deletedProductHistorySchema = z.object({
  reason: z
    .enum(["OUT_OF_STOCK", "DEPRECATED", "NO_LONGER_NEEDED"])
    .default("NO_LONGER_NEEDED"),
});

import { z } from "zod";

export const inventorySchema = z.object({
  productId: z.uuid(),
  warehouseId: z.uuid(),
  availableQty: z.int().nonnegative(),
  reservedQty: z.int().default(0),
  reorderQty: z.int(),
  isReorderPending: z.boolean().default(false),
});

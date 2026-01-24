import { z } from "zod";

export const createInventorySchema = z.object({
  productId: z.uuid(),
  warehouseId: z.uuid(),
  availableQty: z.int().nonnegative(),
  reservedQty: z.int().default(0),
  reorderQty: z.int(),
});

export const updateInventorySchema = createInventorySchema.partial();

export const updateInventoryStatusSchema = z.object({
  isReorderPending: z.boolean(),
});

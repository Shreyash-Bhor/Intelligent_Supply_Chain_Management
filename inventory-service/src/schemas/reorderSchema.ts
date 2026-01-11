import { z } from "zod";

export const reorderSchema = z.object({
  inventoryId: z.uuid(),
  productId: z.uuid(),
  requestedQty: z.int(),
  status: z.enum(["PENDING", "COMPLETED", "CANCELLED"]),
});

CREATE INDEX "Inventory_updatedAt_id_idx"
  ON "Inventory" ("updatedAt" DESC, "id" ASC);

CREATE INDEX "Inventory_warehouseId_updatedAt_id_idx"
  ON "Inventory" ("warehouseId", "updatedAt" DESC, "id" ASC);

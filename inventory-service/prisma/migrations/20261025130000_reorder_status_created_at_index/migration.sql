CREATE INDEX "StockReorder_status_createdAt_id_idx"
  ON "StockReorder" ("status", "createdAt" DESC, "id" DESC);

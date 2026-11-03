-- Supports the existing case-insensitive substring product search and keeps
-- dashboard top-risk ordering from sorting every low-stock row.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX "Product_name_trgm_idx"
  ON "Product" USING GIN ("name" gin_trgm_ops);

CREATE INDEX "Product_sku_trgm_idx"
  ON "Product" USING GIN ("sku" gin_trgm_ops);

CREATE INDEX "Inventory_low_stock_deficit_idx"
  ON "Inventory" ((GREATEST("reorderQty" - "availableQty", 0)) DESC, "id" ASC)
  WHERE "availableQty" <= "reorderQty";

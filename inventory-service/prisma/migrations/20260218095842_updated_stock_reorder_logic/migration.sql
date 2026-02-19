-- DropIndex
DROP INDEX "StockReorder_inventoryId_key";

-- CreateIndex
CREATE INDEX "StockReorder_inventoryId_idx" ON "StockReorder"("inventoryId");

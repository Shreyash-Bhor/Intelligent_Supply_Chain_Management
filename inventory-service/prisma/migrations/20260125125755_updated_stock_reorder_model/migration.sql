/*
  Warnings:

  - A unique constraint covering the columns `[inventoryId]` on the table `StockReorder` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "StockReorder_inventoryId_key" ON "StockReorder"("inventoryId");

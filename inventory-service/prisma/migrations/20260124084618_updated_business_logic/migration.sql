/*
  Warnings:

  - You are about to drop the column `location` on the `Warehouse` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[productId,warehouseId]` on the table `Inventory` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[name]` on the table `Warehouse` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `city` to the `Warehouse` table without a default value. This is not possible if the table is not empty.
  - Added the required column `pincode` to the `Warehouse` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Inventory" ALTER COLUMN "availableQty" SET DEFAULT 0,
ALTER COLUMN "reorderQty" SET DEFAULT 0;

-- AlterTable
ALTER TABLE "Warehouse" DROP COLUMN "location",
ADD COLUMN     "city" TEXT NOT NULL,
ADD COLUMN     "pincode" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Inventory_productId_warehouseId_key" ON "Inventory"("productId", "warehouseId");

-- CreateIndex
CREATE UNIQUE INDEX "Warehouse_name_key" ON "Warehouse"("name");

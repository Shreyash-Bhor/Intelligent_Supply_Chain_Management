/*
  Warnings:

  - You are about to drop the column `deletedAt` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `lastLoginAt` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `passwordChangedAt` on the `User` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "ReorderStatus" AS ENUM ('PENDING', 'COMPLETED', 'CANCELLED');

-- DropIndex
DROP INDEX "User_deletedAt_idx";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "deletedAt",
DROP COLUMN "lastLoginAt",
DROP COLUMN "passwordChangedAt";

-- CreateTable
CREATE TABLE "Inventory" (
    "id" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "availableQty" INTEGER NOT NULL,
    "reservedQty" INTEGER NOT NULL DEFAULT 0,
    "reorderQty" INTEGER NOT NULL,
    "isReorderPending" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Inventory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockReorder" (
    "id" TEXT NOT NULL,
    "inventoryId" TEXT NOT NULL,
    "requestedQty" INTEGER NOT NULL,
    "status" "ReorderStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockReorder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Inventory_warehouseId_idx" ON "Inventory"("warehouseId");

-- CreateIndex
CREATE INDEX "Inventory_isReorderPending_idx" ON "Inventory"("isReorderPending");

-- CreateIndex
CREATE UNIQUE INDEX "Inventory_warehouseId_key" ON "Inventory"("warehouseId");

-- CreateIndex
CREATE INDEX "StockReorder_status_idx" ON "StockReorder"("status");

-- AddForeignKey
ALTER TABLE "StockReorder" ADD CONSTRAINT "StockReorder_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES "Inventory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

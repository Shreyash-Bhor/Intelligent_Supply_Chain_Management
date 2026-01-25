-- CreateEnum
CREATE TYPE "Reason" AS ENUM ('OUT_OF_STOCK', 'DEPRECATED', 'NO_LONGER_NEEDED');

-- CreateTable
CREATE TABLE "ProductDeletion" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "reason" "Reason" NOT NULL DEFAULT 'NO_LONGER_NEEDED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductDeletion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductDeletion_productId_idx" ON "ProductDeletion"("productId");

-- CreateIndex
CREATE INDEX "Product_isActive_idx" ON "Product"("isActive");

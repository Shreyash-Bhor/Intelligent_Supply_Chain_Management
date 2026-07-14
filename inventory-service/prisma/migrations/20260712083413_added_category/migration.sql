-- CreateEnum
CREATE TYPE "Category" AS ENUM ('Electronics', 'Grocery', 'Beverages', 'Fashion', 'Fitness', 'Stationery', 'Sports', 'Toys');

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "category" "Category" NOT NULL DEFAULT 'Electronics';

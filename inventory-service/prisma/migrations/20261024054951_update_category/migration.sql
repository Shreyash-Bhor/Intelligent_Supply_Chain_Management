/*
  Warnings:

  - The values [Grocery,Beverages,Fitness,Stationery] on the enum `Category` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "Category_new" AS ENUM ('Appliances', 'Beauty', 'Electronics', 'Fashion', 'Home_and_Kitchen', 'Mobiles', 'Sports', 'Toys');
ALTER TABLE "public"."Product" ALTER COLUMN "category" DROP DEFAULT;
ALTER TABLE "Product" ALTER COLUMN "category" TYPE "Category_new" USING ("category"::text::"Category_new");
ALTER TYPE "Category" RENAME TO "Category_old";
ALTER TYPE "Category_new" RENAME TO "Category";
DROP TYPE "public"."Category_old";
ALTER TABLE "Product" ALTER COLUMN "category" SET DEFAULT 'Electronics';
COMMIT;

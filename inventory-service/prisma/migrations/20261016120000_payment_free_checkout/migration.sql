-- Country is not collected by the current payment-free order flow.
ALTER TABLE "Address" ALTER COLUMN "country" DROP NOT NULL;

-- A payment-free checkout records item totals only. NULL means that no
-- shipping or tax amount was quoted, rather than implying a calculated zero.
ALTER TABLE "Order"
  ALTER COLUMN "shippingTotal" DROP NOT NULL,
  ALTER COLUMN "shippingTotal" DROP DEFAULT,
  ALTER COLUMN "taxTotal" DROP NOT NULL,
  ALTER COLUMN "taxTotal" DROP DEFAULT;

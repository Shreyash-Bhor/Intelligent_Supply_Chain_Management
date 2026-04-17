import type { UserInventoryProduct } from "@/lib/api";

export type UserCatalogProduct = UserInventoryProduct & {
  description: string;
  price: number | null;
  currency: string;
};

export function buildProductDescription(product: UserInventoryProduct) {
  if (product.description?.trim()) {
    return product.description.trim();
  }

  return `Premium ${product.name} designed for dependable quality and everyday performance.`;
}

export function formatCurrency(price: number | null, currency: string) {
  if (price === null) {
    return "Price on request";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(price);
}

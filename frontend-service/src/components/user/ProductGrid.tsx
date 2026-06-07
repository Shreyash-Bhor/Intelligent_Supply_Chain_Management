"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import type { UserCatalogProduct } from "@/lib/userCatalog";
import { OrderDialog } from "./OrderDialog";
import { ProductCard } from "./ProductCard";

type ProductGridProps = {
  products: UserCatalogProduct[];
  loadingPrices: boolean;
  customerToken: string;
};

export function ProductGrid({
  products,
  loadingPrices,
  customerToken,
}: ProductGridProps) {
  const [selected, setSelected] = useState<UserCatalogProduct | null>(null);
  if (!products.length)
    return (
      <div className="text-muted-foreground rounded-lg border border-dashed p-8 text-center text-sm">
        No products are currently configured in inventory.
      </div>
    );

  return (
    <section className="space-y-4">
      <div className="text-muted-foreground flex items-center justify-between text-xs sm:text-sm">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4" />
          <span>Select a product to place an order</span>
        </div>
        {loadingPrices ? <span>Refreshing latest prices…</span> : null}
      </div>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {products.map((product) => (
          <ProductCard
            key={product.id}
            {...product}
            onClick={() => setSelected(product)}
          />
        ))}
      </div>
      {selected ? (
        <OrderDialog
          product={selected}
          customerToken={customerToken}
          onClose={() => setSelected(null)}
        />
      ) : null}
    </section>
  );
}

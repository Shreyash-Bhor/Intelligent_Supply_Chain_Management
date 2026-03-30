import type { UserInventoryProduct } from "@/lib/api";
import { ProductCard } from "./ProductCard";

type ProductGridProps = {
  products: UserInventoryProduct[];
};

export function ProductGrid({ products }: ProductGridProps) {
  if (!products.length) {
    return (
      <div className="text-muted-foreground rounded-lg border border-dashed p-8 text-center text-sm">
        No products are currently available in inventory.
      </div>
    );
  }

  return (
    <section className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {products.map((product) => (
        <ProductCard
          key={product.id}
          name={product.name}
          imageUrl={product.imageUrl}
        />
      ))}
    </section>
  );
}

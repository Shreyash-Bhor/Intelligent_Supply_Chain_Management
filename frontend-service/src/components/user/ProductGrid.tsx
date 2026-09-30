"use client";

import { useMemo, useState } from "react";
import { Search, Sparkles } from "lucide-react";
import type { UserCatalogProduct } from "@/lib/userCatalog";
import { Pagination } from "@/components/Pagination";
import { OrderDialog } from "./OrderDialog";
import { ProductCard } from "./ProductCard";

const PAGE_SIZE = 9;

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
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"name" | "stock">("name");
  const [page, setPage] = useState(1);
  const filteredProducts = useMemo(() => {
    const term = query.trim().toLowerCase();
    return products
      .filter((product) => !term || product.name.toLowerCase().includes(term))
      .sort((a, b) =>
        sort === "stock"
          ? b.availableQty - a.availableQty || a.name.localeCompare(b.name)
          : a.name.localeCompare(b.name),
      );
  }, [products, query, sort]);

  if (!products.length) {
    return (
      <div className="text-muted-foreground rounded-lg border border-dashed p-8 text-center text-sm">
        No products are currently available to order.
      </div>
    );
  }

  const activePage = Math.min(
    page,
    Math.max(1, Math.ceil(filteredProducts.length / PAGE_SIZE)),
  );
  const visibleProducts = filteredProducts.slice(
    (activePage - 1) * PAGE_SIZE,
    activePage * PAGE_SIZE,
  );

  return (
    <section className="space-y-4">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div className="text-muted-foreground flex items-center gap-2 text-xs sm:text-sm">
          <Sparkles className="size-4" />
          <span>Select a product to review pricing and place an order</span>
          {loadingPrices ? (
            <span className="text-primary">Refreshing prices…</span>
          ) : null}
        </div>
        <div className="flex gap-2">
          <label className="relative min-w-0 flex-1 sm:w-56">
            <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <input
              className="border-input bg-background h-9 w-full rounded-md border pr-3 pl-9 text-sm"
              placeholder="Search products"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(1);
              }}
            />
          </label>
          <select
            aria-label="Sort products"
            className="border-input bg-background rounded-md border px-2 text-sm"
            value={sort}
            onChange={(event) =>
              setSort(event.target.value as "name" | "stock")
            }
          >
            <option value="name">Name</option>
            <option value="stock">Most stock</option>
          </select>
        </div>
      </div>
      {visibleProducts.length ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {visibleProducts.map((product) => (
            <ProductCard
              key={product.id}
              {...product}
              onClick={() => setSelected(product)}
            />
          ))}
        </div>
      ) : (
        <div className="text-muted-foreground rounded-lg border border-dashed p-8 text-center text-sm">
          No products match your search.
        </div>
      )}
      <Pagination
        page={activePage}
        totalItems={filteredProducts.length}
        pageSize={PAGE_SIZE}
        onPageChange={setPage}
      />
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

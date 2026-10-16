"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";
import type { UserInventoryProduct } from "@/lib/api";
import { fetchPagedUserCatalog } from "@/lib/api";
import type { UserCatalogProduct } from "@/lib/userCatalog";
import { addToCart } from "@/lib/cart";
import { useUserProductCatalog } from "@/hooks/useUserProductCatalog";
import { Pagination } from "@/components/Pagination";
import { Button } from "@/components/ui/button";
import { OrderDialog } from "./OrderDialog";
import { ProductCard } from "./ProductCard";

const PAGE_SIZE = 12;
const CATEGORIES = ["Beverages", "Electronics", "Fashion", "Fitness", "Grocery", "Sports", "Stationery", "Toys"];
type Sort = "name" | "price-asc" | "price-desc" | "newest" | "stock";

export function ProductGrid({ customerToken, customerKey, focusProductId }: { customerToken: string; customerKey?: string; focusProductId?: string | null }) {
  const [products, setProducts] = useState<UserInventoryProduct[]>([]);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState<UserCatalogProduct | null>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [inStock, setInStock] = useState(false);
  const [sort, setSort] = useState<Sort>("name");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const { products: pricedProducts, loadingPrices } = useUserProductCatalog(products);

  useEffect(() => {
    const timer = window.setTimeout(() => setQuery(new URLSearchParams(window.location.search).get("q") ?? ""), 0);
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => {
    let active = true;
    void fetchPagedUserCatalog(customerToken, { page, pageSize: PAGE_SIZE, query, category, inStock, sort }).then((result) => {
      if (!active) return;
      setProducts(result.data); setTotal(result.pagination.total);
    }).catch((e) => { if (active) setError(e instanceof Error ? e.message : "Unable to load products"); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [customerToken, page, query, category, inStock, sort]);
  useEffect(() => {
    if (!focusProductId) return;
    const item = pricedProducts.find((product) => product.id === focusProductId);
    if (item) {
      const timer = window.setTimeout(() => setSelected(item), 0);
      return () => window.clearTimeout(timer);
    }
  }, [focusProductId, pricedProducts]);

  const pageCount = useMemo(() => Math.max(1, Math.ceil(total / PAGE_SIZE)), [total]);
  const goToPage = (next: number) => { setLoading(true); setError(""); setPage(Math.min(next, pageCount)); };
  const notifyAdded = (product: UserCatalogProduct, quantity = 1) => {
    void addToCart(customerToken, customerKey, product, quantity).then(() => {
      setNotice(`${product.name} added to your cart.`);
      window.setTimeout(() => setNotice(""), 3000);
    }).catch((e) => setNotice(e instanceof Error ? e.message : "Unable to update your cart."));
  };
  const update = (fn: () => void) => { setLoading(true); setError(""); fn(); setPage(1); };

  return <section className="space-y-5" aria-label="Product catalog">
    <div className="flex flex-col gap-4 rounded-xl border bg-card p-4 sm:flex-row sm:items-center">
      <label className="relative min-w-0 flex-1"><Search className="text-muted-foreground absolute left-3 top-1/2 size-4 -translate-y-1/2" aria-hidden="true"/><span className="sr-only">Search name, SKU, or category</span><input className="border-input bg-background h-11 w-full rounded-md border pl-9 pr-10 text-sm" placeholder="Search products, SKU, categories…" value={query} onChange={(e) => update(() => setQuery(e.target.value))}/>{query && <button type="button" aria-label="Clear search" onClick={() => update(() => setQuery(""))} className="absolute right-3 top-1/2 -translate-y-1/2"><X className="size-4"/></button>}</label>
      <div className="flex flex-wrap gap-2"><label className="flex items-center gap-2 rounded-md border px-3 text-sm"><SlidersHorizontal className="size-4" aria-hidden="true"/><span className="sr-only">Category</span><select aria-label="Filter by category" className="h-10 bg-transparent" value={category} onChange={(e) => update(() => setCategory(e.target.value))}><option value="">All categories</option>{CATEGORIES.map((item) => <option key={item}>{item}</option>)}</select></label><label className="flex items-center gap-2 rounded-md border px-3 text-sm"><input type="checkbox" checked={inStock} onChange={(e) => update(() => setInStock(e.target.checked))}/> In stock</label><label className="rounded-md border px-3 text-sm"><span className="sr-only">Sort products</span><select aria-label="Sort products" className="h-10 bg-transparent" value={sort} onChange={(e) => update(() => setSort(e.target.value as Sort))}><option value="name">Name</option><option value="price-asc">Price: low to high</option><option value="price-desc">Price: high to low</option><option value="newest">Newest</option><option value="stock">Stock</option></select></label></div>
    </div>
    <div className="flex items-center justify-between text-sm"><p className="text-muted-foreground" aria-live="polite">{total} {total === 1 ? "product" : "products"}{loadingPrices ? " · Updating prices…" : ""}</p>{notice && <p role="status" className="text-emerald-700 dark:text-emerald-400">{notice}</p>}</div>
    {error ? <div role="alert" className="rounded-lg border border-destructive/40 p-4 text-destructive">{error}<Button className="ml-3" variant="outline" onClick={() => update(() => setPage((current) => current))}>Retry</Button></div> : loading ? <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{Array.from({ length: 8 }, (_, i) => <div key={i} className="aspect-[4/3] animate-pulse rounded-xl bg-muted"/>)}</div> : pricedProducts.length ? <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{pricedProducts.map((product) => <ProductCard key={product.id} product={product} onQuickView={() => setSelected(product)} onAdd={() => notifyAdded(product)}/>)}</div> : <div className="rounded-xl border border-dashed p-12 text-center"><p className="font-medium">No products match these filters</p><Button variant="outline" className="mt-4" onClick={() => update(() => { setQuery(""); setCategory(""); setInStock(false); })}>Clear filters</Button></div>}
    <Pagination page={page} totalItems={total} pageSize={PAGE_SIZE} onPageChange={goToPage}/>
    {selected && <OrderDialog product={selected} onAddToCart={(quantity) => notifyAdded(selected, quantity)} onClose={() => setSelected(null)}/>}
  </section>;
}

"use client";

import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { IndianRupee, LayoutGrid, Sparkles } from "lucide-react";
import { useAuthSession } from "@/hooks/useAuthSession";
import {
  createProductPrice,
  fetchProductPrice,
  fetchProductPriceHistory,
  fetchProducts,
  updateProductPrice,
  type HistoricalPrice,
  type Product,
  type ProductPrice,
} from "@/lib/api";
import { ProductSearchTable } from "@/components/pricing/ProductSearchTable";
import { PriceEditorCard } from "@/components/pricing/PriceEditorCard";
import { PriceHistoryTable } from "@/components/pricing/PriceHistoryTable";

export default function PricingPage() {
  const router = useRouter();
  const { session: authSession, hydrated } = useAuthSession();
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [currentPrice, setCurrentPrice] = useState<ProductPrice | null>(null);
  const [priceHistory, setPriceHistory] = useState<HistoricalPrice[]>([]);
  const [priceInput, setPriceInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadProducts = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchProducts("active");
      setProducts(data);
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to fetch product catalog",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const loadPricingData = useCallback(async (productId: string) => {
    setLoading(true);
    try {
      const [historyData, priceData] = await Promise.all([
        fetchProductPriceHistory(productId, { take: 100 }),
        fetchProductPrice(productId).catch(() => null),
      ]);
      setPriceHistory(historyData);
      setCurrentPrice(priceData);
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to fetch product pricing",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProducts();
  }, [loadProducts]);

  useEffect(() => {
    if (!hydrated) return;
    if (authSession?.role === "user") {
      router.replace("/user");
    }
  }, [authSession, hydrated, router]);

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return products;

    return products.filter(
      (product) =>
        product.name.toLowerCase().includes(query) ||
        product.sku.toLowerCase().includes(query),
    );
  }, [products, search]);

  const handleSelectProduct = async (product: Product) => {
    setSelectedProduct(product);
    setPriceInput("");
    await loadPricingData(product.id);
  };

  const handlePriceSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedProduct) {
      setError("Select a product first.");
      return;
    }

    const priceValue = Number(priceInput);
    if (Number.isNaN(priceValue) || priceValue <= 0) {
      setError("Provide a valid price greater than 0.");
      return;
    }

    try {
      setLoading(true);
      const payload = {
        price: Number(priceValue.toFixed(2)),
        currency: "INR",
      };

      if (currentPrice) {
        await updateProductPrice(selectedProduct.id, payload);
      } else {
        await createProductPrice({
          productId: selectedProduct.id,
          ...payload,
        });
      }

      setPriceInput("");
      await loadPricingData(selectedProduct.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save price");
      setLoading(false);
    }
  };

  if (!hydrated) {
    return null;
  }

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-8">
      <header className="from-primary/8 to-primary/3 border-primary/20 rounded-2xl border bg-gradient-to-r p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-muted-foreground mb-1 text-xs font-medium tracking-wide uppercase">
              Pricing Console
            </p>
            <h1 className="text-2xl font-semibold">
              Product Pricing Management
            </h1>
            <p className="text-muted-foreground mt-2 text-sm">
              All prices are managed in Indian Rupees (INR) only.
            </p>
          </div>
          <div className="bg-primary/10 text-primary rounded-full p-3">
            <IndianRupee className="size-5" aria-hidden="true" />
          </div>
        </div>
      </header>
      {error ? <p className="text-destructive text-sm">{error}</p> : null}

      <PriceEditorCard
        product={selectedProduct}
        currentPrice={currentPrice}
        priceInput={priceInput}
        loading={loading}
        onPriceChange={setPriceInput}
        onSubmit={handlePriceSubmit}
      />

      <section className="grid gap-4 lg:grid-cols-2">
        <ProductSearchTable
          products={filteredProducts}
          search={search}
          onSearchChange={setSearch}
          selectedProductId={selectedProduct?.id ?? null}
          onSelectProduct={handleSelectProduct}
        />

        <PriceHistoryTable history={priceHistory} />
      </section>

      <footer className="text-muted-foreground flex items-center gap-2 text-xs">
        <LayoutGrid className="size-4" aria-hidden="true" />
        <Sparkles className="size-4" aria-hidden="true" />
        Optimized grid layout with compact pricing tables.
      </footer>
    </main>
  );
}

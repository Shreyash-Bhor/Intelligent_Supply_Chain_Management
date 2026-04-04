"use client";

import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
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
  const [currencyInput, setCurrencyInput] = useState("USD");
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
    setCurrencyInput("USD");
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
        currency: currencyInput.trim().toUpperCase(),
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
      {error ? <p className="text-destructive text-sm">{error}</p> : null}

      <ProductSearchTable
        products={filteredProducts}
        search={search}
        onSearchChange={setSearch}
        selectedProductId={selectedProduct?.id ?? null}
        onSelectProduct={handleSelectProduct}
      />

      <PriceEditorCard
        product={selectedProduct}
        currentPrice={currentPrice}
        priceInput={priceInput}
        currencyInput={currencyInput}
        loading={loading}
        onPriceChange={setPriceInput}
        onCurrencyChange={setCurrencyInput}
        onSubmit={handlePriceSubmit}
      />

      <PriceHistoryTable history={priceHistory} />
    </main>
  );
}

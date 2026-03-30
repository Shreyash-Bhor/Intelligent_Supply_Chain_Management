"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  fetchUserDashboardProducts,
  type UserInventoryProduct,
} from "@/lib/api";
import { ProductGrid } from "@/components/user/ProductGrid";

export default function UserDashboardPage() {
  const [products, setProducts] = useState<UserInventoryProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadProducts = async () => {
      try {
        setLoading(true);
        const data = await fetchUserDashboardProducts();
        setProducts(data);
        setError(null);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load products",
        );
      } finally {
        setLoading(false);
      }
    };

    void loadProducts();
  }, []);

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-8">
      <Card>
        <CardHeader>
          <CardTitle>User Dashboard</CardTitle>
        </CardHeader>
        <CardContent>
          {error ? <p className="text-destructive text-sm">{error}</p> : null}
          {loading ? (
            <p className="text-muted-foreground text-sm">Loading products...</p>
          ) : (
            <ProductGrid products={products} />
          )}
        </CardContent>
      </Card>
    </main>
  );
}

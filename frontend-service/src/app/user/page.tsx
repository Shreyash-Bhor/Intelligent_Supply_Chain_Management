"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  fetchUserDashboardProducts,
  type UserInventoryProduct,
} from "@/lib/api";
import { ProductGrid } from "@/components/user/ProductGrid";
import { clearAuthSession } from "@/lib/auth";
import { useAuthSession } from "@/hooks/useAuthSession";

export default function UserDashboardPage() {
  const router = useRouter();
  const { session, hydrated } = useAuthSession();
  const [products, setProducts] = useState<UserInventoryProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!hydrated || session?.role !== "user") return;

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
  }, [hydrated, session]);

  if (!hydrated) {
    return null;
  }

  if (session?.role === "warehouse_manager") {
    return (
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-4 px-6 py-8">
        <Card>
          <CardHeader>
            <CardTitle>User dashboard is restricted</CardTitle>
            <CardDescription>
              Warehouse manager accounts cannot access the user dashboard.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.push("/")}>
              Go to Manager Dashboard
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  if (session?.role !== "user") {
    return (
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-4 px-6 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Login required</CardTitle>
            <CardDescription>
              Please login or signup as a user to view this dashboard.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex gap-3">
            <Button onClick={() => router.push("/")}>
              Go to Access Portal
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                clearAuthSession();
                router.push("/");
              }}
            >
              Reset session
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

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

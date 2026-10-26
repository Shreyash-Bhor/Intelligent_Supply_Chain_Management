"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BadgeCheck, Store, ArrowRight } from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ProductGrid } from "@/components/user/ProductGrid";
import { clearAuthSession } from "@/lib/auth";
import { useAuthSession } from "@/hooks/useAuthSession";

export default function UserDashboardPage() {
  const router = useRouter();
  const { session, hydrated } = useAuthSession();
  const [productId, setProductId] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setProductId(new URLSearchParams(window.location.search).get("product")), 0);
    return () => window.clearTimeout(timer);
  }, []);


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
            <Button onClick={() => router.push("/manager")}>
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
            <Button onClick={() => router.push("/manager")}>
              Go to Access Portal
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                clearAuthSession();
                router.push("/manager");
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
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-6 sm:px-6 lg:py-10">
      <section className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        <div className="grid gap-6 bg-[linear-gradient(115deg,color-mix(in_oklch,var(--primary)_10%,var(--card)),var(--card)_62%)] px-6 py-9 sm:px-10 sm:py-12 md:grid-cols-[1fr_auto] md:items-center">
          <div className="max-w-2xl space-y-4">
            <div className="text-primary flex items-center gap-2 text-sm font-medium"><Store className="size-4" /><span>SupplySync Store</span></div>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Everyday essentials, in one place.</h1>
            <p className="text-muted-foreground max-w-xl">Explore products currently available in our supply network. Live stock and prices come from SupplySync.</p>
            <Link href="#products" className="bg-primary text-primary-foreground inline-flex min-h-10 items-center gap-2 rounded-md px-4 text-sm font-medium">Browse products <ArrowRight className="size-4" /></Link>
          </div>
          <div className="hidden rounded-xl border bg-card/80 p-5 text-sm shadow-sm md:block"><BadgeCheck className="text-emerald-600 mb-3 size-6" /><p className="font-medium">Inventory-backed availability</p><p className="text-muted-foreground mt-1">Order requests are checked against live stock.</p></div>
        </div>
      </section>
      <section id="products" className="space-y-5">
        <div><p className="text-primary text-sm font-medium">The catalog</p><h2 className="mt-1 text-2xl font-semibold tracking-tight">Find your next favorite</h2></div>
        <ProductGrid customerToken={session.token ?? ""} customerKey={session.email} focusProductId={productId} />
      </section>
    </main>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BadgeCheck, Store, ArrowRight, Sparkles, PackageCheck, ShoppingBag, Truck } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ProductGrid } from "@/components/user/ProductGrid";
import { clearAuthSession } from "@/lib/auth";
import { useAuthSession } from "@/hooks/useAuthSession";

const SHOPPING_FEATURES: { icon: LucideIcon; title: string; detail: string }[] = [
  { icon: Store, title: "Explore with ease", detail: "Search and filter the catalog to find what fits." },
  { icon: BadgeCheck, title: "Know what’s available", detail: "Availability is checked against live stock." },
  { icon: Truck, title: "Follow your purchases", detail: "Review order updates any time." },
];

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
      <section className="landing-hero landing-enter relative isolate overflow-hidden rounded-3xl border bg-card shadow-sm">
        <div className="landing-orbit pointer-events-none absolute -right-12 -top-24 -z-10 size-72 rounded-full border border-primary/15 sm:size-96"/><div className="landing-orbit landing-orbit-reverse pointer-events-none absolute right-10 top-5 -z-10 size-52 rounded-full border border-secondary/30"/>
        <div className="grid gap-8 px-6 py-9 sm:px-10 sm:py-12 lg:grid-cols-[1fr_auto] lg:items-center lg:px-14">
          <div className="max-w-2xl space-y-5">
            <div className="inline-flex items-center gap-2 rounded-full border bg-background/70 px-3 py-1.5 text-xs font-semibold text-primary"><Sparkles className="size-3.5"/>A smarter way to shop</div>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-5xl">Good finds, ready when you are.</h1>
            <p className="max-w-xl leading-7 text-muted-foreground">Discover useful essentials from across the SupplySync network. Browse live availability, compare prices, and build your cart at your own pace.</p>
            <div className="flex flex-wrap gap-3"><Link href="#products" className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg">Explore the catalog <ArrowRight className="size-4"/></Link><Link href="/assistant" className="inline-flex min-h-11 items-center gap-2 rounded-lg border bg-background/70 px-4 text-sm font-medium transition-colors hover:bg-muted"><Sparkles className="size-4 text-primary"/>Ask the shopping assistant</Link></div>
          </div>
          <div className="landing-float hidden w-64 rounded-2xl border bg-card/85 p-5 shadow-xl backdrop-blur sm:block"><div className="flex items-center justify-between"><span className="grid size-11 place-items-center rounded-xl bg-secondary/20 text-primary"><ShoppingBag className="size-5"/></span><span className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400"><span className="size-1.5 animate-pulse rounded-full bg-emerald-500"/>Live</span></div><p className="mt-5 font-semibold">Shopping made simple</p><p className="mt-1 text-sm leading-6 text-muted-foreground">Products and availability are connected to live inventory.</p><div className="mt-5 flex items-center gap-2 border-t pt-4 text-xs text-muted-foreground"><PackageCheck className="size-4 text-primary"/>Stock-aware product discovery</div></div>
        </div>
      </section>
      <section aria-label="Shopping features" className="grid gap-3 sm:grid-cols-3">
        {SHOPPING_FEATURES.map(({ icon: FeatureIcon, title, detail }, index) => <article key={title} className={`landing-reveal landing-delay-${index+1} flex items-start gap-3 rounded-2xl border bg-card p-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-md`}><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><FeatureIcon className="size-5"/></span><span><span className="block text-sm font-semibold">{title}</span><span className="mt-1 block text-xs leading-5 text-muted-foreground">{detail}</span></span></article>)}
      </section>
      <section id="products" className="space-y-5">
        <div><p className="text-primary text-sm font-medium">The catalog</p><h2 className="mt-1 text-2xl font-semibold tracking-tight">Find your next favorite</h2></div>
        <ProductGrid customerToken={session.token ?? ""} customerKey={session.email} focusProductId={productId} />
      </section>
    </main>
  );
}

"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, PackageCheck, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuthSession } from "@/hooks/useAuthSession";
import { fetchCustomerOrders, type CustomerOrder } from "@/lib/api";
import { formatCurrency } from "@/lib/userCatalog";

export default function OrdersPage() {
  const { session, hydrated } = useAuthSession();
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    if (!session?.token) return;
    setLoading(true); setError("");
    try { setOrders(await fetchCustomerOrders(session.token)); }
    catch (e) { setError(e instanceof Error ? e.message : "Unable to load your orders"); }
    finally { setLoading(false); }
  }, [session?.token]);
  useEffect(() => { if (hydrated && session?.role === "user") void load(); }, [hydrated, session?.role, load]);
  if (!hydrated) return null;
  if (session?.role !== "user") return <main className="mx-auto max-w-3xl px-4 py-12"><h1 className="text-2xl font-semibold">Sign in to view your orders</h1><Link className="text-primary mt-4 inline-block underline" href="/">Go to sign in</Link></main>;
  return <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6"><Link href="/user" className="text-muted-foreground inline-flex items-center gap-2 text-sm"><ArrowLeft className="size-4"/> Continue shopping</Link><div className="mt-5 flex items-center justify-between"><div><p className="text-primary text-sm font-medium">Your account</p><h1 className="mt-1 text-3xl font-semibold">Order history</h1></div><Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}><RefreshCw className="mr-2 size-4"/>Refresh</Button></div>
    {error && <div role="alert" className="mt-5 rounded-lg border border-destructive/40 p-4 text-sm text-destructive">{error}<Button variant="outline" className="ml-3" onClick={() => void load()}>Retry</Button></div>}
    {loading ? <div className="mt-6 space-y-3">{[0,1,2].map((i) => <div key={i} className="h-32 animate-pulse rounded-xl bg-muted"/>)}</div> : !error && !orders.length ? <section className="mt-8 rounded-2xl border border-dashed p-12 text-center"><PackageCheck className="text-muted-foreground mx-auto size-10"/><h2 className="mt-3 text-xl font-semibold">No orders yet</h2><p className="text-muted-foreground mt-1 text-sm">Your orders will appear here.</p><Button asChild className="mt-5"><Link href="/user">Explore products</Link></Button></section> : <div className="mt-6 space-y-4">{orders.map((order) => {
      const items = order.items?.length ? order.items : [{ id: order.id, productId: order.product.id, quantity: order.quantity, allocatedQty: order.allocatedQty, unitPrice: String(order.unitPrice), totalPrice: String(order.totalPrice), product: order.product }];
      return <article key={order.id} className="rounded-xl border bg-card p-4 sm:p-5"><div className="flex flex-wrap items-start justify-between gap-2 border-b pb-3"><div><p className="text-muted-foreground text-xs">Order placed {new Date(order.createdAt).toLocaleDateString()}</p><p className="mt-1 text-xs">Order ID <Link href={`/orders/${order.id}`} className="font-mono underline underline-offset-2">{order.id}</Link></p></div><div className="text-right"><span className="rounded-full bg-muted px-2.5 py-1 text-xs">{order.status.replaceAll("_", " ")}</span><p className="text-muted-foreground mt-2 text-xs">Payment {order.paymentStatus ?? "not available"}</p></div></div>
        {items.map((item) => <div key={item.id} className="flex items-center gap-4 border-b py-4 last:border-0"><div className="bg-muted/30 relative size-16 shrink-0 overflow-hidden rounded-lg">{item.product.imageUrl && <Image src={item.product.imageUrl} alt={item.product.name} fill className="object-contain p-2" sizes="64px"/>}</div><div className="min-w-0 flex-1"><p className="font-medium">{item.product.name}</p><p className="text-muted-foreground mt-1 text-sm">SKU {item.product.sku} · Qty {item.quantity} · {item.allocatedQty} reserved</p></div><p className="text-right text-sm font-semibold">{formatCurrency(Number(item.totalPrice), order.currency)}</p></div>)}
        <div className="flex items-center justify-between pt-3"><span className="text-muted-foreground text-sm">{order.shipments?.length ? `Shipment ${order.shipments[0].status}` : "Awaiting fulfillment"}</span><Link href={`/orders/${order.id}`} className="text-primary text-sm underline">Total {formatCurrency(Number(order.totalPrice), order.currency)} · View order</Link></div>
      </article>;
    })}</div>}
  </main>;
}

"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuthSession } from "@/hooks/useAuthSession";
import { cancelCustomerOrder, fetchCustomerOrder, type CustomerOrder } from "@/lib/api";
import { formatCurrency } from "@/lib/userCatalog";

export default function OrderConfirmationPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { session, hydrated } = useAuthSession();
  const [orderId, setOrderId] = useState("");
  const [order, setOrder] = useState<CustomerOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [cancelling, setCancelling] = useState(false);
  useEffect(() => { let active = true; void params.then(({ orderId: id }) => { if (active) setOrderId(id); }); return () => { active = false; }; }, [params]);
  const load = useCallback(async () => {
    if (!session?.token || !orderId) return;
    setLoading(true); setError("");
    try { setOrder(await fetchCustomerOrder(session.token, orderId)); }
    catch (e) { setError(e instanceof Error ? e.message : "Unable to load this order"); }
    finally { setLoading(false); }
  }, [session?.token, orderId]);
  useEffect(() => { if (hydrated && session?.role === "user" && orderId) void load(); }, [hydrated, session?.role, orderId, load]);
  if (!hydrated) return null;
  if (session?.role !== "user") return <main className="mx-auto max-w-3xl px-4 py-12"><h1 className="text-2xl font-semibold">Sign in to view this order</h1><Link className="text-primary mt-4 inline-block underline" href="/manager">Go to sign in</Link></main>;
  const lines = order?.items?.length ? order.items : order ? [{ id: order.id, productId: order.product.id, quantity: order.quantity, allocatedQty: order.allocatedQty, unitPrice: String(order.unitPrice), totalPrice: String(order.totalPrice), product: order.product }] : [];
  const cancel = async () => {
    if (!session?.token || !orderId) return;
    setCancelling(true); setError("");
    try { setOrder(await cancelCustomerOrder(session.token, orderId)); }
    catch (e) { setError(e instanceof Error ? e.message : "Unable to cancel this order"); }
    finally { setCancelling(false); }
  };
  return <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6"><Link href="/orders" className="text-muted-foreground inline-flex items-center gap-2 text-sm hover:text-foreground"><ArrowLeft className="size-4"/> Order history</Link>
    {loading ? <div className="mt-8 h-64 animate-pulse rounded-xl bg-muted"/> : error ? <section role="alert" className="mt-6 rounded-xl border border-destructive/40 p-5 text-sm text-destructive">{error}<Button variant="outline" className="ml-3" onClick={() => void load()}><RefreshCw className="mr-2 size-4"/>Retry</Button></section> : !order ? <section className="mt-8 rounded-xl border p-6"><h1 className="text-xl font-semibold">Order not found</h1><p className="text-muted-foreground mt-2 text-sm">This order may no longer be available to this account.</p></section> : <>
      <section className="mt-6 rounded-2xl border border-emerald-600/30 bg-emerald-600/5 p-6"><CheckCircle2 className="text-emerald-600 size-8"/><p className="text-emerald-700 mt-3 text-sm font-medium dark:text-emerald-400">Order received</p><h1 className="mt-1 text-2xl font-semibold">Order details</h1><p className="text-muted-foreground mt-2 text-sm">Order ID <span className="font-mono">{order.id}</span></p><p className="mt-2 text-sm">Order status: {order.status} · Payment status: {order.paymentReference?.startsWith("mock_") ? "TEST PAYMENT · no real payment collected" : order.paymentStatus ?? "not available"}</p></section>
      <section className="mt-5 rounded-xl border bg-card p-5"><h2 className="font-semibold">Items</h2>{lines.map((item) => <div key={item.id} className="flex items-center gap-4 border-b py-5 last:border-0"><div className="bg-muted/30 relative size-20 shrink-0 overflow-hidden rounded-lg">{item.product.imageUrl && <Image src={item.product.imageUrl} alt={item.product.name} fill className="object-contain p-2" sizes="80px"/>}</div><div className="flex-1"><p className="font-medium">{item.product.name}</p><p className="text-muted-foreground mt-1 text-sm">SKU {item.product.sku} · Quantity {item.quantity} · {item.allocatedQty} reserved</p><p className="text-muted-foreground mt-1 text-sm">{formatCurrency(Number(item.unitPrice), order.currency)} each</p></div><p className="font-semibold">{formatCurrency(Number(item.totalPrice), order.currency)}</p></div>)}
        <dl className="space-y-2 pt-4 text-sm"><div className="flex justify-between"><dt className="text-muted-foreground">Items subtotal</dt><dd>{formatCurrency(Number(order.subtotal ?? order.totalPrice), order.currency)}</dd></div>{order.shippingTotal != null && <div className="flex justify-between"><dt className="text-muted-foreground">Shipping</dt><dd>{formatCurrency(Number(order.shippingTotal), order.currency)}</dd></div>}{order.taxTotal != null && <div className="flex justify-between"><dt className="text-muted-foreground">Tax</dt><dd>{formatCurrency(Number(order.taxTotal), order.currency)}</dd></div>}{order.shippingTotal == null && order.taxTotal == null && <p className="text-muted-foreground">Shipping and tax are not calculated for this order.</p>}<div className="flex justify-between border-t pt-3 text-base font-semibold"><dt>Order total</dt><dd>{formatCurrency(Number(order.totalPrice), order.currency)}</dd></div></dl>
      </section>
      <section className="mt-5 rounded-xl border bg-card p-5"><h2 className="font-semibold">Shipping address</h2><p className="text-muted-foreground mt-2 text-sm">{order.shippingName ?? "Address unavailable"}{order.shippingAddress1 ? ` · ${order.shippingAddress1}` : ""}{order.shippingAddress2 ? `, ${order.shippingAddress2}` : ""}{order.shippingCity ? `, ${order.shippingCity}` : ""}{order.shippingRegion ? `, ${order.shippingRegion}` : ""}{order.shippingPostalCode ? ` ${order.shippingPostalCode}` : ""}{order.shippingCountry ? `, ${order.shippingCountry}` : ""}</p></section>
      <section className="mt-5 rounded-xl border bg-card p-5"><h2 className="font-semibold">Shipment tracking</h2>{order.shipments?.length ? order.shipments.map((shipment) => <div key={shipment.id} className="mt-3 text-sm"><p>Status: {shipment.status}</p>{shipment.carrier && <p>Carrier: {shipment.carrier}</p>}{shipment.trackingNumber && <p>Tracking: {shipment.trackingNumber}</p>}</div>) : <p className="text-muted-foreground mt-2 text-sm">No shipment has been created yet.</p>}</section>
      <Button asChild className="mt-5"><Link href="/user">Continue shopping</Link></Button>
      {((order.status === "PENDING_PAYMENT" && order.paymentStatus === "PENDING") || (order.status === "CONFIRMED" && order.paymentStatus === "NOT_STARTED")) && <Button className="ml-2 mt-5" variant="outline" disabled={cancelling} onClick={() => void cancel()}>{cancelling ? "Cancelling…" : "Cancel order"}</Button>}
    </>}
  </main>;
}

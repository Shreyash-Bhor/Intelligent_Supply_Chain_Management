"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Minus, Plus, Trash2, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuthSession } from "@/hooks/useAuthSession";
import { cartEventName, readCart, syncCart, updateCartQuantity, type CartLine } from "@/lib/cart";
import { createCartOrder, createCustomerAddress, deleteCustomerAddress, fetchCheckoutQuote, fetchCustomerAddresses, updateCustomerAddress, type CheckoutQuote, type CustomerOrder, type ShippingAddress } from "@/lib/api";
import { formatCurrency } from "@/lib/userCatalog";

const emptyAddress = { name: "", phone: "", address1: "", address2: "", city: "", region: "", postalCode: "" };

export default function CartPage() {
  const { session, hydrated } = useAuthSession();
  const [lines, setLines] = useState<CartLine[]>([]);
  const [addresses, setAddresses] = useState<ShippingAddress[]>([]);
  const [address, setAddress] = useState(emptyAddress);
  const [addressId, setAddressId] = useState("");
  const [editingAddress, setEditingAddress] = useState(false);
  const [quote, setQuote] = useState<CheckoutQuote | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [order, setOrder] = useState<CustomerOrder | null>(null);
  const idempotencyKey = useRef<string | null>(null);
  const token = session?.token ?? "";
  const userKey = session?.email;

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [cart, saved] = await Promise.all([syncCart(token, userKey), fetchCustomerAddresses(token)]);
      setLines(cart);
      setAddresses(saved);
      setAddressId((current) => saved.some((item) => item.id === current) ? current : saved[0]?.id || "");
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to load your cart"); }
    finally { setLoading(false); }
  }, [token, userKey]);

  useEffect(() => { if (hydrated && session?.role === "user") void load(); }, [hydrated, session?.role, load]);
  useEffect(() => { const sync = () => setLines(readCart(userKey)); window.addEventListener(cartEventName, sync); return () => window.removeEventListener(cartEventName, sync); }, [userKey]);

  const changeQuantity = async (productId: string, quantity: number) => {
    if (!token) return;
    setError("");
    try { await updateCartQuantity(token, userKey, productId, quantity); setLines(readCart(userKey)); setQuote(null); }
    catch (e) { setError(e instanceof Error ? e.message : "Unable to update your cart"); }
  };
  const saveAddress = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setError(""); setNotice("");
    try {
      const wasEditing = editingAddress && !!addressId;
      const body = { ...address, address2: address.address2 || null };
      const saved = wasEditing ? await updateCustomerAddress(token, addressId, body) : await createCustomerAddress(token, body);
      setAddresses((current) => wasEditing ? current.map((item) => item.id === saved.id ? saved : item) : [saved, ...current]);
      setAddressId(saved.id); setAddress(emptyAddress); setEditingAddress(false); setQuote(null);
      setNotice(wasEditing ? "Shipping address updated." : "Shipping address saved.");
    }
    catch (e) { setError(e instanceof Error ? e.message : "Unable to save this address"); }
    finally { setBusy(false); }
  };
  const editSelectedAddress = () => {
    const selected = addresses.find((item) => item.id === addressId);
    if (!selected) return;
    setAddress({ name: selected.name, phone: selected.phone, address1: selected.address1, address2: selected.address2 ?? "", city: selected.city, region: selected.region, postalCode: selected.postalCode });
    setEditingAddress(true); setQuote(null);
  };
  const removeSelectedAddress = async () => {
    if (!addressId) return;
    setBusy(true); setError("");
    try {
      await deleteCustomerAddress(token, addressId);
      const remaining = addresses.filter((item) => item.id !== addressId);
      setAddresses(remaining); setAddressId(remaining[0]?.id ?? ""); setQuote(null);
      setNotice("Shipping address deleted.");
      if (editingAddress) { setEditingAddress(false); setAddress(emptyAddress); }
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to delete this address"); }
    finally { setBusy(false); }
  };
  const getQuote = async () => {
    if (!addressId) return;
    setBusy(true); setError("");
    try { setQuote(await fetchCheckoutQuote(token, addressId)); }
    catch (e) { setQuote(null); setError(e instanceof Error ? e.message : "Checkout quote is unavailable"); }
    finally { setBusy(false); }
  };
  const checkout = async () => {
    if (!quote || !addressId) return;
    setBusy(true); setError("");
    try {
      idempotencyKey.current ??= crypto.randomUUID();
      const created = await createCartOrder(token, { addressId, quoteToken: quote.quoteToken }, idempotencyKey.current);
      idempotencyKey.current = null;
      setOrder(created); setQuote(null); setLines(await syncCart(token, userKey));
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to create the order. Your cart is preserved."); setQuote(null); }
    finally { setBusy(false); }
  };

  if (!hydrated) return null;
  if (session?.role !== "user") return <main className="mx-auto max-w-3xl px-4 py-12"><h1 className="text-2xl font-semibold">Sign in to view your cart</h1><Link className="text-primary mt-4 inline-block underline" href="/">Go to sign in</Link></main>;
  const count = lines.reduce((sum, line) => sum + line.quantity, 0);
  return <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
    <Link href="/user" className="text-muted-foreground inline-flex items-center gap-2 text-sm hover:text-foreground"><ArrowLeft className="size-4"/> Continue shopping</Link>
    <h1 className="mt-5 text-3xl font-semibold">Your cart <span className="text-muted-foreground text-lg font-normal">({count} items)</span></h1>
    {order && <section role="status" className="mt-5 rounded-xl border border-emerald-600/30 bg-emerald-600/5 p-5"><h2 className="font-semibold">Order placed</h2><p className="mt-1 text-sm">Order {order.id} · {formatCurrency(Number(order.totalPrice), order.currency)} · Inventory reserved. Payment was not collected.</p><Link className="text-primary mt-3 inline-block text-sm underline" href={`/orders/${order.id}`}>View order</Link></section>}
    {error && <p role="alert" className="mt-4 rounded-md border border-destructive/40 p-3 text-sm text-destructive">{error}</p>}
    {notice && <p role="status" className="mt-3 text-sm text-emerald-700 dark:text-emerald-400">{notice}</p>}
    {!lines.length ? <section className="mt-8 rounded-2xl border border-dashed p-12 text-center"><ShoppingBag className="text-muted-foreground mx-auto size-10"/><h2 className="mt-3 text-xl font-semibold">Your cart is empty</h2><p className="text-muted-foreground mt-1 text-sm">Browse the catalog and add something you need.</p><Button asChild className="mt-5"><Link href="/user">Explore products</Link></Button></section> : <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
      <div className="space-y-3">{lines.map(({ product, quantity, unavailable }) => <article key={product.id} className="flex flex-col gap-4 rounded-xl border bg-card p-4 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1"><p className="text-muted-foreground text-xs">SKU {product.sku}</p><h2 className="font-medium">{product.name}</h2><p className="mt-1 text-sm font-semibold">{formatCurrency(product.price, product.currency)}</p><p className="text-muted-foreground mt-1 text-xs">{unavailable ? "Unavailable; remove this item to continue." : `${product.availableQty} available`}</p></div>
        <div className="flex items-center gap-2"><Button variant="outline" size="icon" aria-label={`Decrease ${product.name} quantity`} onClick={() => void changeQuantity(product.id, quantity - 1)}><Minus className="size-4"/></Button><span className="w-8 text-center">{quantity}</span><Button variant="outline" size="icon" aria-label={`Increase ${product.name} quantity`} onClick={() => void changeQuantity(product.id, quantity + 1)}><Plus className="size-4"/></Button><Button variant="ghost" size="icon" aria-label={`Remove ${product.name}`} onClick={() => void changeQuantity(product.id, 0)}><Trash2 className="size-4"/></Button></div>
      </article>)}</div>
      <aside className="h-fit rounded-xl border bg-card p-5"><h2 className="font-semibold">Checkout</h2>
        {loading ? <p role="status" className="text-muted-foreground mt-3 text-sm">Loading saved addresses…</p> : <><label className="mt-3 block text-sm">Saved address<select aria-label="Saved shipping address" className="mt-1 h-10 w-full rounded-md border bg-background px-2" value={addressId} onChange={(e) => { setAddressId(e.target.value); setQuote(null); }}><option value="">Choose an address</option>{addresses.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.address1}, {item.city}</option>)}</select>{addresses.length === 0 && <span className="text-muted-foreground mt-1 block">No saved addresses yet. Add one below.</span>}</label>{!!addressId && <div className="mt-2 flex gap-2"><Button type="button" variant="outline" size="sm" disabled={busy} onClick={editSelectedAddress}>Edit selected</Button><Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => void removeSelectedAddress()}>Delete selected</Button></div>}</>}
        <details className="mt-3" open={editingAddress}><summary className="cursor-pointer text-sm underline">{editingAddress ? "Edit shipping address" : "Add a shipping address"}</summary><form onSubmit={saveAddress} className="mt-3 space-y-2">{(["name", "phone", "address1", "address2", "city", "region", "postalCode"] as const).map((field) => <input key={field} required={field !== "address2"} className="h-10 w-full rounded-md border bg-background px-3 text-sm" placeholder={field} value={address[field]} onChange={(e) => setAddress({ ...address, [field]: e.target.value })}/>)}<Button type="submit" variant="outline" className="w-full" disabled={busy}>{editingAddress ? "Update address" : "Save address"}</Button>{editingAddress && <Button type="button" variant="ghost" className="w-full" disabled={busy} onClick={() => { setEditingAddress(false); setAddress(emptyAddress); }}>Cancel edit</Button>}</form></details>
        <Button className="mt-4 w-full" variant="outline" disabled={busy || !addressId || lines.some((line) => line.unavailable)} onClick={() => void getQuote()}>{busy && !quote ? "Calculating…" : "Calculate checkout total"}</Button>
        {quote && <div className="mt-4 space-y-2 border-t pt-4 text-sm"><p className="font-medium">Order summary</p>{quote.lines.map((line) => <div key={line.productId} className="flex justify-between"><span>{line.name} × {line.quantity}</span><span>{formatCurrency(Number(line.lineTotal), quote.currency)}</span></div>)}<div className="flex justify-between"><span>Items subtotal</span><span>{formatCurrency(Number(quote.subtotal), quote.currency)}</span></div><p className="text-muted-foreground text-xs">Shipping and tax are not calculated. No payment is collected in this checkout.</p><div className="flex justify-between border-t pt-2 text-base font-semibold"><span>Order total</span><span>{formatCurrency(Number(quote.total), quote.currency)}</span></div><p className="text-muted-foreground text-xs">Quote expires {new Date(quote.expiresAt).toLocaleTimeString()}.</p><Button className="w-full" disabled={busy || Date.parse(quote.expiresAt) <= Date.now()} onClick={() => void checkout()}>{busy ? "Placing order…" : "Place order"}</Button></div>}
      </aside>
    </div>}
  </main>;
}

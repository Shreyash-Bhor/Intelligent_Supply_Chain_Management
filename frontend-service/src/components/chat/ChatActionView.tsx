"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { CheckCircle2, Clock3, MapPin, PackageSearch, ShoppingBag, LoaderCircle } from "lucide-react";
import { useAuthSession } from "@/hooks/useAuthSession";
import { createCustomerAddress, fetchCustomerAddresses, fetchCustomerCart, fetchCustomerProductAvailability, fetchCustomerProfile, fetchProductPrice, setCustomerCartItem, setCustomerDefaultAddress, updateCustomerAddress, type CustomerProfile, type ShippingAddress } from "@/lib/api";
import type { ChatAction } from "@/components/chat/protocol";
import { StructuredFormView } from "@/components/chat/StructuredFormView";

type AddressFormData = { addresses: ShippingAddress[]; profile: CustomerProfile | null; addressError?: string };
const addressFormCache = new Map<string, Promise<AddressFormData>>();
function loadAddressFormData(token: string) {
  const cached = addressFormCache.get(token);
  if (cached) return cached;
  const request = Promise.allSettled([fetchCustomerAddresses(token), fetchCustomerProfile(token)]).then(([addressResult, profileResult]) => ({
    addresses: addressResult.status === "fulfilled" ? addressResult.value : [],
    profile: profileResult.status === "fulfilled" ? profileResult.value : null,
    ...(addressResult.status === "rejected" ? { addressError: addressResult.reason instanceof Error ? addressResult.reason.message : "Saved addresses could not be loaded." } : {}),
  }));
  addressFormCache.set(token, request);
  return request;
}

export function ChatActionView({ action, onConfirm, busy, onFormSubmit, instanceId = "chat-action" }: { action: ChatAction; onConfirm: () => void; busy: boolean; onFormSubmit?: (action: Extract<ChatAction, { type: "structured_form" }>, values: Record<string, string | number | boolean>) => Promise<void>; instanceId?: string }) {
  const [confirmed, setConfirmed] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const [cartBusy, setCartBusy] = useState(false);
  const [cartMessage, setCartMessage] = useState("");
  const cartSubmitting = useRef(false);
  const { session, hydrated } = useAuthSession();
  const [addresses, setAddresses] = useState<ShippingAddress[]>([]);
  const profileRef = useRef<CustomerProfile | null>(null);
  const [contactEmail, setContactEmail] = useState("");
  const [formAddress, setFormAddress] = useState({ name: "", phone: "", address1: "", address2: "", city: "", region: "", postalCode: "", country: "" });
  const [selectedAddress, setSelectedAddress] = useState("");
  const [makeDefault, setMakeDefault] = useState(false);
  const [addressLoading, setAddressLoading] = useState(false);
  const [addressBusy, setAddressBusy] = useState(false);
  const [addressError, setAddressError] = useState("");
  const [addressFieldErrors, setAddressFieldErrors] = useState<Partial<Record<keyof typeof formAddress, string>>>({});
  const [addressSaved, setAddressSaved] = useState(false);
  const addressSubmitting = useRef(false);
  useEffect(() => {
    if (!hydrated || action.type !== "address_form" || session?.role !== "user" || !session.token) return;
    let cancelled = false;
    profileRef.current = null;
    setAddresses([]); setContactEmail(""); setSelectedAddress("");
    setFormAddress((current) => ({ ...current, name: session.name ?? "" }));
    setAddressLoading(true);
    void loadAddressFormData(session.token).then(({ addresses: saved, profile: customer, addressError: loadError }) => {
      if (cancelled) return;
      setAddresses(saved);
      if (customer) { profileRef.current = customer; setContactEmail(customer.email); }
      if (loadError) setAddressError(loadError);
      const latest = saved.find((address) => address.isDefault) ?? saved[0];
      if (latest) {
        setSelectedAddress(latest.id);
        setFormAddress({ name: latest.name, phone: latest.phone, address1: latest.address1, address2: latest.address2 ?? "", city: latest.city, region: latest.region, postalCode: latest.postalCode, country: latest.country ?? "" });
      } else {
        setMakeDefault(true);
        setFormAddress((current) => ({ ...current, name: customer?.name ?? "" }));
      }
    }).catch((error: unknown) => {
      if (!cancelled) setAddressError(error instanceof Error ? error.message : "Saved addresses could not be loaded.");
    }).finally(() => { if (!cancelled) setAddressLoading(false); });
    return () => { cancelled = true; };
  }, [action.type, hydrated, session?.email, session?.name, session?.role, session?.token]);

  const saveAddress = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (addressSubmitting.current) return;
    if (!session?.token) { setAddressError("Your session expired. Sign in again to save this address."); return; }
    const errors: Partial<Record<keyof typeof formAddress, string>> = {};
    if (formAddress.name.trim().length < 2) errors.name = "Enter a name with at least 2 characters.";
    if (!/^\+?[0-9 ()-]{7,20}$/.test(formAddress.phone.trim())) errors.phone = "Enter a valid phone number.";
    if (formAddress.address1.trim().length < 4) errors.address1 = "Enter at least 4 characters.";
    if (formAddress.city.trim().length < 2) errors.city = "Enter a city.";
    if (formAddress.region.trim().length < 2) errors.region = "Enter a state or region.";
    if (!/^[A-Za-z0-9 -]{3,12}$/.test(formAddress.postalCode.trim())) errors.postalCode = "Enter a valid postal code.";
    if (formAddress.country.trim() && !/^[A-Za-z]{2}$/.test(formAddress.country.trim())) errors.country = "Use a two-letter country code.";
    setAddressFieldErrors(errors);
    if (Object.keys(errors).length) return;
    addressSubmitting.current = true;
    setAddressBusy(true); setAddressError("");
    try {
      const body = { ...formAddress, address2: formAddress.address2.trim() || null, country: formAddress.country.trim() || null };
      let saved: ShippingAddress;
      if (selectedAddress) saved = await updateCustomerAddress(session.token, selectedAddress, body);
      else {
        const keyName = `supplysync-address-submit:${session.email}:${instanceId}`;
        let key = window.localStorage.getItem(keyName);
        if (!key) { key = crypto.randomUUID(); window.localStorage.setItem(keyName, key); }
        saved = await createCustomerAddress(session.token, { ...body, isDefault: makeDefault }, key);
      }
      const nextAddresses = selectedAddress ? [saved, ...addresses.filter((item) => item.id !== saved.id)] : [saved, ...addresses];
      const normalizedAddresses = saved.isDefault ? nextAddresses.map((item) => ({ ...item, isDefault: item.id === saved.id })) : nextAddresses;
      setAddresses(normalizedAddresses);
      addressFormCache.set(session.token, Promise.resolve({ addresses: normalizedAddresses, profile: profileRef.current }));
      setSelectedAddress(saved.id);
      setAddressSaved(true);
    } catch (error) {
      setAddressError(error instanceof Error ? error.message : "Unable to save this address. Review the fields and retry.");
    } finally { addressSubmitting.current = false; setAddressBusy(false); }
  };

  const changeDefaultAddress = async () => {
    if (!session?.token || !selectedAddress || addressBusy) return;
    setAddressBusy(true); setAddressError("");
    try {
      const updated = await setCustomerDefaultAddress(session.token, selectedAddress);
      const nextAddresses = addresses.map((item) => ({ ...item, isDefault: item.id === updated.id }));
      setAddresses(nextAddresses);
      addressFormCache.set(session.token, Promise.resolve({ addresses: nextAddresses, profile: profileRef.current }));
    } catch (error) { setAddressError(error instanceof Error ? error.message : "Unable to change the default address."); }
    finally { setAddressBusy(false); }
  };

  if (action.type === "address_form") {
    if (session?.role !== "user") return <p role="status" className="mt-3 rounded-lg border p-3 text-sm">Sign in with a customer account to manage delivery addresses.</p>;
    const update = (field: keyof typeof formAddress, value: string) => { if (!selectedAddress && session?.email) window.localStorage.setItem(`supplysync-address-submit:${session.email}:${instanceId}`, crypto.randomUUID()); setFormAddress((current) => ({ ...current, [field]: value })); setAddressSaved(false); setAddressFieldErrors((current) => ({ ...current, [field]: undefined })); };
    const fields: Array<[keyof typeof formAddress, string, string]> = [["name", "Full name", "text"], ["phone", "Phone number", "tel"], ["address1", "Address line 1", "text"], ["address2", "Address line 2 (optional)", "text"], ["city", "City", "text"], ["region", "State or region", "text"], ["postalCode", "Postal code", "text"], ["country", "Country code (optional)", "text"]];
    return <section className="mt-4 rounded-2xl border bg-card p-4" aria-label="Delivery address form">
      <div className="mb-3"><h3 className="font-semibold">Delivery address</h3><p className="mt-1 text-xs text-muted-foreground">Account details are autofilled where available. Changes here affect your address only when you save.</p></div>
      {addresses.length > 0 && <label className="mb-3 block text-sm">Use saved address<select className="mt-1 h-10 w-full rounded-md border bg-background px-2" value={selectedAddress} onChange={(event) => { const saved = addresses.find((item) => item.id === event.target.value); if (!event.target.value && session?.email) window.localStorage.setItem(`supplysync-address-submit:${session.email}:${instanceId}`, crypto.randomUUID()); setSelectedAddress(event.target.value); if (saved) setFormAddress({ name: saved.name, phone: saved.phone, address1: saved.address1, address2: saved.address2 ?? "", city: saved.city, region: saved.region, postalCode: saved.postalCode, country: saved.country ?? "" }); setMakeDefault(!addresses.some((item) => item.isDefault)); setAddressSaved(false); }}><option value="">Enter a new address</option>{addresses.map((item) => <option key={item.id} value={item.id}>{item.isDefault ? "Default · " : ""}{item.name} · {item.address1}, {item.city}</option>)}</select></label>}
      {selectedAddress && !addresses.find((item) => item.id === selectedAddress)?.isDefault && <button type="button" disabled={addressBusy || addressLoading} onClick={() => void changeDefaultAddress()} className="mb-3 min-h-9 rounded-lg border px-3 text-xs font-medium disabled:opacity-50">{addressBusy ? "Updating…" : "Make this my default address"}</button>}
      {addressLoading && <p role="status" className="mb-3 text-xs text-muted-foreground">Loading saved addresses…</p>}
      <form onSubmit={(event) => void saveAddress(event)} className="grid gap-3 sm:grid-cols-2">
        {!selectedAddress && <label className="inline-flex items-center gap-2 text-xs"><input type="checkbox" checked={makeDefault} onChange={(event) => setMakeDefault(event.target.checked)} className="size-4"/>Make this my default address</label>}
        <label className="block text-xs font-medium">Email address<input type="email" autoComplete="email" value={contactEmail} onChange={(event) => setContactEmail(event.target.value)} className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm" /></label>
        {Object.entries(addressFieldErrors).map(([field, message]) => message ? <p id={`address-error-${field}`} key={field} role="alert" className="sm:col-span-2 text-xs text-destructive">{message}</p> : null)}
        {fields.map(([field, label, type]) => <label key={field} className={`block text-xs font-medium ${field === "address1" || field === "address2" ? "sm:col-span-2" : ""}`}>{label}<input required={!(["address2", "country"] as string[]).includes(field)} type={type} autoComplete={field === "name" ? "name" : field === "phone" ? "tel" : field === "address1" ? "address-line1" : field === "address2" ? "address-line2" : field === "city" ? "address-level2" : field === "region" ? "address-level1" : field === "postalCode" ? "postal-code" : "country"} maxLength={field === "country" ? 2 : 160} aria-invalid={!!addressFieldErrors[field]} aria-describedby={addressFieldErrors[field] ? `address-error-${field}` : undefined} value={formAddress[field]} onChange={(event) => update(field, event.target.value)} className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm" /></label>)}
        {addressError && <p role="alert" className="sm:col-span-2 text-xs text-destructive">{addressError}</p>}
        {addressSaved ? <p role="status" className="sm:col-span-2 flex items-center gap-2 text-sm text-emerald-700"><CheckCircle2 className="size-4"/>Address {selectedAddress ? "updated" : "saved"} to your account.</p> : <button type="submit" disabled={addressBusy || addressLoading} className="sm:col-span-2 inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50">{addressBusy && <LoaderCircle className="size-4 animate-spin"/>}{addressBusy ? "Saving address…" : selectedAddress ? "Update saved address" : "Save new address"}</button>}
      </form>
    </section>;
  }
  if (action.type === "product_detail") {
    const addToCart = async () => {
      if (cartSubmitting.current || session?.role !== "user" || !session.token) return;
      cartSubmitting.current = true; setCartBusy(true); setCartMessage("");
      try {
        const [currentPrice, availability, cart] = await Promise.all([
          fetchProductPrice(action.productId),
          fetchCustomerProductAvailability(session.token, action.productId),
          fetchCustomerCart(session.token),
        ]);
        if (action.price === null || !action.currency || Number(currentPrice.price).toFixed(2) !== Number(action.price).toFixed(2) || currentPrice.currency !== action.currency) {
          setCartMessage("The price changed. Ask for the product details again before adding it."); return;
        }
        const existing = cart.items.find((line) => line.productId === action.productId);
        const quantity = (existing?.quantity ?? 0) + 1;
        if (availability.availableQty < quantity) { setCartMessage(availability.availableQty > 0 ? `Only ${availability.availableQty} units are currently available.` : "This product is currently out of stock."); return; }
        await setCustomerCartItem(session.token, action.productId, quantity);
        setCartMessage("Added 1 unit to your cart.");
      } catch (error) { setCartMessage(error instanceof Error ? error.message : "Could not add this product to your cart. Retry."); }
      finally { cartSubmitting.current = false; setCartBusy(false); }
    };
    return <article className="mt-4 overflow-hidden rounded-2xl border bg-card shadow-sm sm:flex" aria-label={`Product details for ${action.name}`}>
      <div className="aspect-[4/3] bg-muted sm:aspect-auto sm:w-48 sm:shrink-0">
        {action.imageUrl && !imageFailed ? <>
          {/* Product images may be hosted by the customer's catalog service. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={action.imageUrl} alt={action.name} loading="lazy" className="size-full object-cover" onError={() => setImageFailed(true)} />
        </> : <div className="grid size-full min-h-36 place-items-center text-muted-foreground"><PackageSearch className="size-10" aria-hidden="true" /></div>}
      </div>
      <div className="min-w-0 flex-1 space-y-2 p-4">
        <div><h3 className="text-base font-semibold">{action.name}</h3><p className="text-xs text-muted-foreground">SKU {action.sku}{action.category ? ` · ${action.category}` : ""}</p></div>
        <p className="text-sm font-semibold">{action.price !== null && action.currency ? `${action.price} ${action.currency}` : "Current price unavailable"}</p>
        <p className="text-xs text-muted-foreground">{action.availableQty === null ? "Availability could not be verified" : action.availableQty > 0 ? `${action.availableQty} available` : "Currently out of stock"}</p>
        {action.discount && <p className="text-xs font-medium text-emerald-700">{action.discount}</p>}
        {action.description && <p className="whitespace-pre-wrap text-sm text-muted-foreground">{action.description}</p>}
        {Object.keys(action.attributes).length > 0 && <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">{Object.entries(action.attributes).map(([key, value]) => <div key={key} className="contents"><dt className="text-muted-foreground">{key}</dt><dd>{String(value)}</dd></div>)}</dl>}
        <div className="flex flex-wrap gap-2"><Link href={`/user?product=${encodeURIComponent(action.productId)}&q=${encodeURIComponent(action.sku)}`} className="inline-flex min-h-9 items-center gap-2 rounded-lg border px-3 text-xs font-semibold"><ShoppingBag className="size-3.5"/>View product</Link>{session?.role === "user" && <button type="button" onClick={() => void addToCart()} disabled={cartBusy || action.availableQty === 0} className="inline-flex min-h-9 items-center gap-2 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground disabled:opacity-50">{cartBusy && <LoaderCircle className="size-3.5 animate-spin"/>}{cartBusy ? "Checking…" : "Add 1 to cart"}</button>}</div>
        {cartMessage && <p role="status" className="text-xs text-muted-foreground">{cartMessage}</p>}
      </div>
    </article>;
  }
  if (action.type === "product_comparison") return <section className="mt-4 rounded-2xl border bg-card p-4" aria-label="Product comparison"><h3 className="font-semibold">Product comparison</h3><div className="grid gap-3 md:grid-cols-2">{action.products.map((product) => <ChatActionView key={product.productId} action={{ ...product, type: "product_detail" }} onConfirm={onConfirm} busy={busy} onFormSubmit={onFormSubmit} />)}</div></section>;
  if (action.type === "structured_form" && action.action === "show_address_form") return <ChatActionView action={{ type: "address_form" }} onConfirm={onConfirm} busy={busy} onFormSubmit={onFormSubmit} instanceId={instanceId} />;
  if (action.type === "structured_form") return <StructuredFormView action={action} onSubmit={(values) => onFormSubmit ? onFormSubmit(action, values) : Promise.resolve()} />;
  if (action.type !== "checkout_summary") return null;
  const address = action.address;
  const addressText = [address.name, address.address1, address.address2, address.city, address.region, address.postalCode, address.country].filter(Boolean).join(", ");
  const expired = Date.parse(action.expiresAt) <= Date.now();
  return <section className="mt-4 space-y-3 rounded-2xl border border-primary/20 bg-card p-4 shadow-sm" aria-label="Checkout confirmation summary">
    <div><h3 className="font-semibold">Review your checkout</h3><p className="mt-1 text-xs text-muted-foreground">This exact quote must be confirmed before an order is placed.</p></div>
    <div className="divide-y divide-border/70">{action.lines.map((line) => <div key={line.productId} className="flex justify-between gap-3 py-2 text-sm"><span>{line.name} <span className="text-muted-foreground">× {line.quantity}</span><span className="block text-xs text-muted-foreground">SKU {line.sku} · {line.unitPrice} {line.currency} each</span></span><span className="shrink-0 font-medium">{line.lineTotal} {line.currency}</span></div>)}</div>
    <div className="flex gap-2 text-sm"><MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground"/><span>{addressText || "Address details unavailable"}</span></div>
    <div className="space-y-1 border-t pt-3 text-sm"><div className="flex justify-between"><span>Subtotal</span><span>{action.subtotal} {action.currency}</span></div><div className="flex justify-between"><span>Shipping</span><span>{action.shippingTotal ? `${action.shippingTotal} ${action.currency}` : "Not calculated"}</span></div><div className="flex justify-between"><span>Tax</span><span>{action.taxTotal ? `${action.taxTotal} ${action.currency}` : "Not calculated"}</span></div><div className="flex justify-between border-t pt-2 text-base font-semibold"><span>Final payable amount</span><span>{action.total} {action.currency}</span></div></div>
    <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Clock3 className="size-3.5"/>Quote expires {new Date(action.expiresAt).toLocaleString()}</p>
    {confirmed ? <p role="status" className="flex items-center gap-2 text-sm font-medium text-emerald-700"><CheckCircle2 className="size-4"/>Confirmation sent. Waiting for the order service…</p> : <button type="button" disabled={busy || expired} onClick={() => { setConfirmed(true); onConfirm(); }} className="min-h-10 w-full rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50">{expired ? "Quote expired — prepare a new one" : busy ? "Confirming…" : "Confirm and place this order"}</button>}
    <p className="text-center text-[11px] text-muted-foreground">No payment is collected at checkout.</p>
  </section>;
}

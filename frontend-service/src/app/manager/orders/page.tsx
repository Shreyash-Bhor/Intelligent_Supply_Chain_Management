"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDownUp, CalendarDays, ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useAuthSession } from "@/hooks/useAuthSession";
import { useManagerSession } from "@/hooks/useManagerSession";
import { fetchManagerOrderAnalytics, fetchManagerOrders, type ManagerOrder, type ManagerOrderAnalytics, type ManagerOrdersPage } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const statusNames: Record<string, string> = { PENDING_PAYMENT: "Pending", CONFIRMED: "Confirmed", BACKORDERED: "Backordered", CANCELLED: "Cancelled", FULFILLED: "Delivered" };
const chartColors = ["#3b82f6", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6"];
const money = (value: number, currency = "USD") => new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 2 }).format(value);
const shortDate = (value: string) => new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(value));
const isoDate = (date: Date) => date.toISOString().slice(0, 10);

function Metric({ label, value, detail, loading }: { label: string; value: string; detail: string; loading: boolean }) {
  return <Card className="orders-enter transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"><CardContent className="p-5"><p className="text-muted-foreground text-sm">{label}</p><p className="mt-2 text-2xl font-semibold tabular-nums">{loading ? <span className="inline-block h-7 w-24 animate-pulse rounded bg-muted" /> : value}</p><p className="text-muted-foreground mt-1 text-xs">{detail}</p></CardContent></Card>;
}

export default function ManagerOrdersPage() {
  const router = useRouter();
  const { session: authSession, hydrated } = useAuthSession();
  const { managerSession, hydrated: managerHydrated } = useManagerSession();
  const [range, setRange] = useState(() => ({ from: isoDate(new Date(Date.now() - 29 * 86400000)), to: isoDate(new Date()) }));
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [warehouseId, setWarehouseId] = useState("all");
  const [sort, setSort] = useState("date");
  const [direction, setDirection] = useState("desc");
  const [page, setPage] = useState(1);
  const [table, setTable] = useState<ManagerOrdersPage | null>(null);
  const [analytics, setAnalytics] = useState<ManagerOrderAnalytics | null>(null);
  const [selected, setSelected] = useState<ManagerOrder | null>(null);
  const [tableLoading, setTableLoading] = useState(true);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [error, setError] = useState("");
  const [analyticsError, setAnalyticsError] = useState("");

  useEffect(() => {
    if (!hydrated || !managerHydrated) return;
    if (authSession?.role === "user") router.replace("/assistant");
    else if (!managerSession) router.replace("/login/manager");
  }, [authSession, hydrated, managerHydrated, managerSession, router]);

  const loadTable = useCallback(async () => {
    if (!managerSession) return;
    setTableLoading(true); setError("");
    try {
      setTable(await fetchManagerOrders(managerSession, { page, pageSize: 20, search, status, warehouseId: warehouseId === "all" ? "" : warehouseId, from: range.from ? new Date(`${range.from}T00:00:00`).toISOString() : "", to: range.to ? new Date(`${range.to}T23:59:59.999`).toISOString() : "", sort, direction }));
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to load orders"); }
    finally { setTableLoading(false); }
  }, [managerSession, page, search, status, warehouseId, range, sort, direction]);

  const loadAnalytics = useCallback(async () => {
    if (!managerSession || !range.from || !range.to) return;
    setAnalyticsLoading(true); setAnalyticsError("");
    try { setAnalytics(await fetchManagerOrderAnalytics(managerSession, new Date(`${range.from}T00:00:00`).toISOString(), new Date(`${range.to}T23:59:59.999`).toISOString())); }
    catch (e) { setAnalyticsError(e instanceof Error ? e.message : "Unable to load order analytics"); }
    finally { setAnalyticsLoading(false); }
  }, [managerSession, range]);

  useEffect(() => { void loadTable(); }, [loadTable]);
  useEffect(() => { void loadAnalytics(); }, [loadAnalytics]);
  useEffect(() => { const timer = window.setTimeout(() => { setPage(1); setSearch(query.trim()); }, 300); return () => window.clearTimeout(timer); }, [query]);
  useEffect(() => {
    if (!selected) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setSelected(null); };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [selected]);

  const chartStatus = useMemo(() => analytics?.statusDistribution.map((item) => ({ ...item, name: statusNames[item.name] ?? item.name })) ?? [], [analytics]);
  if (!hydrated || !managerHydrated || !managerSession) return null;

  return <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-4 py-7 sm:px-6 lg:px-8">
    <header className="orders-enter flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-primary text-sm font-medium">Warehouse management</p><h1 className="mt-1 text-3xl font-semibold tracking-tight">Customer orders</h1><p className="text-muted-foreground mt-2 text-sm">Review orders across customers, track fulfillment, and monitor sales performance.</p></div>
      <div className="flex flex-wrap items-end gap-2 rounded-xl border bg-card p-3"><CalendarDays className="text-muted-foreground mb-2 size-4"/><label className="grid gap-1 text-xs text-muted-foreground">From<input aria-label="Analytics start date" type="date" value={range.from} max={range.to || undefined} onChange={(e) => { setRange((v) => ({ ...v, from: e.target.value })); setPage(1); }} className="bg-background text-foreground h-9 rounded-md border px-2 text-sm"/></label><label className="grid gap-1 text-xs text-muted-foreground">To<input aria-label="Analytics end date" type="date" value={range.to} min={range.from || undefined} onChange={(e) => { setRange((v) => ({ ...v, to: e.target.value })); setPage(1); }} className="bg-background text-foreground h-9 rounded-md border px-2 text-sm"/></label></div>
    </header>

    {analyticsError && <div role="alert" className="rounded-lg border border-destructive/40 p-3 text-sm text-destructive">{analyticsError}</div>}
    <section aria-label="Order performance metrics" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      <Metric label="Total orders" value={(analytics?.totalOrders ?? 0).toLocaleString()} detail="Orders in selected range" loading={analyticsLoading}/>
      <Metric label="Order value" value={money(analytics?.totalRevenue ?? 0)} detail="Gross order value" loading={analyticsLoading}/>
      <Metric label="Pending" value={(analytics?.pendingOrders ?? 0).toLocaleString()} detail="Awaiting payment" loading={analyticsLoading}/>
      <Metric label="Processing" value={(analytics?.processingOrders ?? 0).toLocaleString()} detail="Confirmed or backordered" loading={analyticsLoading}/>
      <Metric label="Delivered" value={(analytics?.deliveredOrders ?? 0).toLocaleString()} detail="Fulfilled orders" loading={analyticsLoading}/>
      <Metric label="Cancelled" value={(analytics?.cancelledOrders ?? 0).toLocaleString()} detail="Cancelled orders" loading={analyticsLoading}/>
    </section>

    <section className="grid gap-4 xl:grid-cols-2" aria-label="Order analytics charts">
      <Card className="orders-enter"><CardHeader><CardTitle>Orders and revenue over time</CardTitle></CardHeader><CardContent><div className="h-64">{analyticsLoading ? <div className="h-full animate-pulse rounded-lg bg-muted"/> : !analytics?.trends.length ? <EmptyChart/> : <ResponsiveContainer width="100%" height="100%"><LineChart data={analytics.trends}><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="date" tickFormatter={shortDate} minTickGap={24}/><YAxis yAxisId="orders" allowDecimals={false} width={34}/><YAxis yAxisId="revenue" orientation="right" width={58}/><Tooltip labelFormatter={(label) => new Date(String(label)).toLocaleDateString()} formatter={(value, name) => [name === "revenue" ? money(Number(value)) : value, name === "revenue" ? "Revenue" : "Orders"]}/><Line yAxisId="orders" dataKey="orders" name="orders" stroke="#3b82f6" strokeWidth={2} dot={false} isAnimationActive/><Line yAxisId="revenue" dataKey="revenue" name="revenue" stroke="#10b981" strokeWidth={2} dot={false} isAnimationActive/></LineChart></ResponsiveContainer>}</div></CardContent></Card>
      <Card className="orders-enter"><CardHeader><CardTitle>Order status distribution</CardTitle></CardHeader><CardContent><div className="h-64">{analyticsLoading ? <div className="h-full animate-pulse rounded-lg bg-muted"/> : !chartStatus.length ? <EmptyChart/> : <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={chartStatus} dataKey="value" nameKey="name" innerRadius={58} outerRadius={88} paddingAngle={3} isAnimationActive>{chartStatus.map((item, i) => <Cell key={item.name} fill={chartColors[i % chartColors.length]}/>)}</Pie><Tooltip formatter={(value) => [Number(value).toLocaleString(), "Orders"]}/></PieChart></ResponsiveContainer>}</div></CardContent></Card>
      <Card className="orders-enter"><CardHeader><CardTitle>Top products by quantity</CardTitle></CardHeader><CardContent><div className="h-64">{analyticsLoading ? <div className="h-full animate-pulse rounded-lg bg-muted"/> : !analytics?.topProducts.length ? <EmptyChart/> : <ResponsiveContainer width="100%" height="100%"><BarChart data={analytics.topProducts} layout="vertical" margin={{ left: 10, right: 12 }}><CartesianGrid strokeDasharray="3 3" horizontal={false}/><XAxis type="number" allowDecimals={false}/><YAxis type="category" dataKey="name" width={112} tick={{ fontSize: 11 }}/><Tooltip/><Bar dataKey="quantity" name="Units" fill="#6366f1" radius={[0, 5, 5, 0]} isAnimationActive/></BarChart></ResponsiveContainer>}</div></CardContent></Card>
      <Card className="orders-enter"><CardHeader><CardTitle>Orders by warehouse</CardTitle></CardHeader><CardContent><div className="h-64">{analyticsLoading ? <div className="h-full animate-pulse rounded-lg bg-muted"/> : !analytics?.warehouses.length ? <EmptyChart/> : <ResponsiveContainer width="100%" height="100%"><BarChart data={analytics.warehouses}><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="name" tick={{ fontSize: 11 }}/><YAxis allowDecimals={false}/><Tooltip/><Bar dataKey="count" name="Orders" fill="#0d9488" radius={[5, 5, 0, 0]} isAnimationActive/></BarChart></ResponsiveContainer>}</div></CardContent></Card>
    </section>

    <Card className="orders-enter"><CardHeader><CardTitle>All orders</CardTitle></CardHeader><CardContent className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-[minmax(220px,1fr)_180px_220px_150px_140px]"><label className="relative"><Search className="text-muted-foreground absolute left-3 top-1/2 size-4 -translate-y-1/2"/><input aria-label="Search order ID or customer" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search order ID or customer" className="bg-background h-10 w-full rounded-md border pl-9 pr-3 text-sm"/></label><select aria-label="Filter by status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="bg-background h-10 rounded-md border px-3 text-sm"><option value="all">All statuses</option>{Object.entries(statusNames).map(([key, name]) => <option key={key} value={key}>{name}</option>)}</select><select aria-label="Filter by warehouse" value={warehouseId} onChange={(e) => { setWarehouseId(e.target.value); setPage(1); }} className="bg-background h-10 rounded-md border px-3 text-sm"><option value="all">All warehouses</option>{table?.warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name} · {warehouse.city}</option>)}</select><select aria-label="Sort orders" value={sort} onChange={(e) => setSort(e.target.value)} className="bg-background h-10 rounded-md border px-3 text-sm"><option value="date">Order date</option><option value="value">Order value</option><option value="status">Status</option></select><Button variant="outline" onClick={() => setDirection((v) => v === "desc" ? "asc" : "desc")}><ArrowDownUp className="size-4"/>{direction === "desc" ? "Descending" : "Ascending"}</Button></div>
      {error && <div role="alert" className="rounded-lg border border-destructive/40 p-3 text-sm text-destructive">{error}<Button variant="outline" size="sm" className="ml-3" onClick={() => void loadTable()}>Retry</Button></div>}
      <div className="overflow-x-auto rounded-lg border"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-muted/60 text-muted-foreground"><tr>{["Order", "Customer", "Warehouse", "Order date", "Total", "Status", "Details"].map((title) => <th key={title} className="px-4 py-3 font-medium">{title}</th>)}</tr></thead><tbody className="divide-y">{tableLoading ? Array.from({ length: 5 }, (_, i) => <tr key={i}>{Array.from({ length: 7 }, (_, j) => <td key={j} className="px-4 py-4"><span className="block h-4 animate-pulse rounded bg-muted"/></td>)}</tr>) : !table?.items.length ? <tr><td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">{error ? "Orders could not be loaded." : "No orders match these filters."}</td></tr> : table.items.map((order) => { const warehouses = [...new Map(order.allocations.map((a) => [a.inventory.warehouse.id, a.inventory.warehouse.name])).values()]; return <tr key={order.id} className="transition-colors hover:bg-muted/30"><td className="max-w-32 truncate px-4 py-3 font-mono text-xs" title={order.id}>{order.id.slice(0, 8)}…</td><td className="px-4 py-3"><p className="font-medium">{order.user.name}</p><p className="text-muted-foreground text-xs">{order.user.email}</p></td><td className="px-4 py-3">{warehouses.join(", ") || "—"}</td><td className="px-4 py-3 whitespace-nowrap">{new Date(order.createdAt).toLocaleDateString()}</td><td className="px-4 py-3 font-medium whitespace-nowrap">{money(order.totalPrice, order.currency)}</td><td className="px-4 py-3"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${order.status === "CANCELLED" ? "bg-red-500/10 text-red-700 dark:text-red-300" : order.status === "FULFILLED" ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : order.status === "PENDING_PAYMENT" ? "bg-amber-500/10 text-amber-700 dark:text-amber-300" : "bg-blue-500/10 text-blue-700 dark:text-blue-300"}`}>{statusNames[order.status] ?? order.status}</span></td><td className="px-4 py-3"><Button variant="outline" size="sm" onClick={() => setSelected(order)}>View</Button></td></tr>; })}</tbody></table></div>
      <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-muted-foreground text-sm">{table ? `${table.pagination.total.toLocaleString()} orders · Page ${table.pagination.page} of ${Math.max(table.pagination.totalPages, 1)}` : "Loading orders…"}</p><div className="flex gap-2"><Button variant="outline" size="sm" onClick={() => setPage((v) => Math.max(1, v - 1))} disabled={page <= 1 || tableLoading}><ChevronLeft className="size-4"/>Previous</Button><Button variant="outline" size="sm" onClick={() => setPage((v) => Math.min(table?.pagination.totalPages ?? v, v + 1))} disabled={tableLoading || page >= (table?.pagination.totalPages ?? 1)}>Next<ChevronRight className="size-4"/></Button></div></div>
    </CardContent></Card>

    {selected && <div className="fixed inset-0 z-[70] flex justify-end bg-black/45" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) setSelected(null); }}><aside role="dialog" aria-modal="true" aria-labelledby="order-detail-title" className="orders-drawer bg-background h-full w-full max-w-xl overflow-y-auto border-l shadow-2xl"><div className="sticky top-0 flex items-start justify-between border-b bg-background/95 p-5 backdrop-blur"><div><p className="text-muted-foreground text-xs">Order details</p><h2 id="order-detail-title" className="mt-1 break-all font-mono text-lg font-semibold">{selected.id}</h2><p className="mt-1 text-sm">{statusNames[selected.status] ?? selected.status}</p></div><Button variant="ghost" size="icon" aria-label="Close order details" onClick={() => setSelected(null)}><X className="size-4"/></Button></div><div className="space-y-6 p-5"><section><h3 className="font-semibold">Customer</h3><p className="mt-2 text-sm">{selected.user.name}</p><p className="text-muted-foreground text-sm">{selected.user.email}</p>{(selected.shippingPhone || selected.shippingAddress1) && <p className="text-muted-foreground mt-2 text-sm">{[selected.shippingPhone, selected.shippingAddress1, selected.shippingAddress2, selected.shippingCity, selected.shippingRegion, selected.shippingPostalCode, selected.shippingCountry].filter(Boolean).join(" · ")}</p>}</section><section><h3 className="font-semibold">Products</h3><div className="mt-2 divide-y rounded-lg border">{(selected.items.length ? selected.items : [{ id: selected.id, product: selected.product, quantity: selected.quantity, unitPrice: selected.unitPrice, totalPrice: selected.totalPrice }]).map((item) => <div key={item.id} className="flex items-center justify-between gap-3 p-3"><div><p className="text-sm font-medium">{item.product.name}</p><p className="text-muted-foreground text-xs">SKU {item.product.sku} · Qty {item.quantity} · {money(item.unitPrice, selected.currency)} each</p></div><p className="text-sm font-semibold">{money(item.totalPrice, selected.currency)}</p></div>)}</div><div className="flex justify-between border-b py-3 text-sm"><span>Total amount</span><span className="font-semibold">{money(selected.totalPrice, selected.currency)}</span></div></section><section><h3 className="font-semibold">Warehouse allocation</h3><div className="mt-2 space-y-2">{selected.allocations.length ? selected.allocations.map((allocation, i) => <div key={`${allocation.inventory.warehouse.id}-${i}`} className="rounded-lg border p-3 text-sm"><p className="font-medium">{allocation.inventory.warehouse.name}</p><p className="text-muted-foreground">{allocation.inventory.warehouse.city} · {allocation.inventory.warehouse.pincode} · {allocation.quantity} units</p></div>) : <p className="text-muted-foreground text-sm">No warehouse allocation recorded</p>}</div></section><section><h3 className="font-semibold">Timestamps</h3><dl className="mt-2 grid grid-cols-2 gap-3 text-sm"><div><dt className="text-muted-foreground">Placed</dt><dd>{new Date(selected.createdAt).toLocaleString()}</dd></div><div><dt className="text-muted-foreground">Last updated</dt><dd>{new Date(selected.updatedAt).toLocaleString()}</dd></div>{selected.shipments.map((shipment, i) => <div key={i}><dt className="text-muted-foreground">Shipment · {shipment.status}</dt><dd>{shipment.deliveredAt ? new Date(shipment.deliveredAt).toLocaleString() : shipment.shippedAt ? new Date(shipment.shippedAt).toLocaleString() : new Date(shipment.createdAt).toLocaleString()}</dd></div>)}</dl></section></div></aside></div>}
  </main>;
}

function EmptyChart() { return <div className="text-muted-foreground flex h-full items-center justify-center text-sm">No order data for this date range</div>; }

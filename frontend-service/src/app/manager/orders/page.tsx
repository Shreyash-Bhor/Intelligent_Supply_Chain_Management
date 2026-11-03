"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDownUp,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clipboard,
  Clock3,
  PackageCheck,
  RotateCcw,
  Search,
  ShoppingBag,
  TrendingUp,
  XCircle,
  X,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useAuthSession } from "@/hooks/useAuthSession";
import { useManagerSession } from "@/hooks/useManagerSession";
import {
  fetchManagerOrderAnalytics,
  fetchManagerOrders,
  type ManagerOrder,
  type ManagerOrderAnalytics,
  type ManagerOrdersPage,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatINR, formatINRCompact } from "@/lib/currency";

const statusNames: Record<string, string> = {
  PENDING_PAYMENT: "Pending",
  CONFIRMED: "Confirmed",
  BACKORDERED: "Backordered",
  CANCELLED: "Cancelled",
  FULFILLED: "Delivered",
};
const chartColors = ["#256d50", "#d38d22", "#3286c7", "#cf4d4d", "#8058b4"];
const statusColors: Record<string, string> = {
  Pending: "#d38d22",
  Confirmed: "#3286c7",
  Backordered: "#8058b4",
  Cancelled: "#cf4d4d",
  Delivered: "#256d50",
};
const pad = (value: number) => String(value).padStart(2, "0");
const localDate = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const shortDate = (value: string) =>
  new Intl.DateTimeFormat("en-IN", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
const validDateInput = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return (
    Number.isFinite(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
};
const dateRangeTimestamps = (from: string, to: string) => ({
  from: new Date(`${from}T00:00:00.000Z`).toISOString(),
  to: new Date(`${to}T23:59:59.999Z`).toISOString(),
});

function Metric({
  label,
  value,
  detail,
  loading,
  icon: Icon,
  index,
  currency = false,
}: {
  label: string;
  value: number;
  detail: string;
  loading: boolean;
  icon: typeof ShoppingBag;
  index: number;
  currency?: boolean;
}) {
  return (
    <Card
      style={{ animationDelay: `${index * 55}ms` }}
      className="orders-enter border-emerald-900/10 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md dark:border-emerald-100/10"
    >
      <CardContent className="flex min-h-[126px] items-start gap-3 p-4 sm:p-5">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
          <Icon className="size-[18px]" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="text-muted-foreground text-xs font-medium sm:text-sm">
            {label}
          </p>
          <p className="mt-1 text-xl font-semibold tracking-tight tabular-nums sm:text-2xl">
            {loading ? (
              <span className="inline-block h-7 w-24 animate-pulse rounded bg-muted" />
            ) : (
              <CountUp value={value} currency={currency} />
            )}
          </p>
          <p className="text-muted-foreground mt-1 text-xs">{detail}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function CountUp({
  value,
  currency = false,
}: {
  value: number;
  currency?: boolean;
}) {
  const [display, setDisplay] = useState(0);
  const current = useRef(0);
  useEffect(() => {
    const initial = current.current;
    const target = Number.isFinite(value) ? value : 0;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      current.current = target;
      setDisplay(target);
      return;
    }
    const startedAt = performance.now();
    let frame = 0;
    const step = (time: number) => {
      const progress = Math.min((time - startedAt) / 520, 1);
      const next = initial + (target - initial) * (1 - (1 - progress) ** 3);
      current.current = next;
      setDisplay(next);
      if (progress < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [value]);
  return (
    <>
      {currency
        ? formatINR(display)
        : Math.round(display).toLocaleString("en-IN")}
    </>
  );
}

export default function ManagerOrdersPage() {
  const router = useRouter();
  const { session: authSession, hydrated } = useAuthSession();
  const { managerSession, hydrated: managerHydrated } = useManagerSession();
  const [range, setRange] = useState(() => ({
    from: localDate(new Date(Date.now() - 29 * 86400000)),
    to: localDate(new Date()),
  }));
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [warehouseId, setWarehouseId] = useState("all");
  const [sort, setSort] = useState("date");
  const [direction, setDirection] = useState("desc");
  const [page, setPage] = useState(1);
  const [table, setTable] = useState<ManagerOrdersPage | null>(null);
  const [analytics, setAnalytics] = useState<ManagerOrderAnalytics | null>(
    null,
  );
  const [selected, setSelected] = useState<ManagerOrder | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const closeTimer = useRef<number | null>(null);
  const [copiedOrderId, setCopiedOrderId] = useState("");
  const [tableLoading, setTableLoading] = useState(true);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [error, setError] = useState("");
  const [analyticsError, setAnalyticsError] = useState("");
  const openOrder = (order: ManagerOrder) => {
    if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
    setSelected(order);
    setDetailOpen(true);
  };
  const closeOrder = () => {
    setDetailOpen(false);
    if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setSelected(null), 190);
  };
  const rangeIsValid =
    validDateInput(range.from) &&
    validDateInput(range.to) &&
    range.from <= range.to;
  const rangeError =
    range.from &&
    range.to &&
    validDateInput(range.from) &&
    validDateInput(range.to) &&
    range.from > range.to
      ? "The start date must be on or before the end date."
      : !validDateInput(range.from) || !validDateInput(range.to)
        ? "Choose a valid start and end date to view order analytics."
        : "";

  useEffect(() => {
    if (!hydrated || !managerHydrated) return;
    if (authSession?.role === "user") router.replace("/assistant");
    else if (!managerSession) router.replace("/login/manager");
  }, [authSession, hydrated, managerHydrated, managerSession, router]);

  const loadTable = useCallback(async () => {
    if (!managerSession) return;
    if (!rangeIsValid) {
      setTable(null);
      setTableLoading(false);
      return;
    }
    setTableLoading(true);
    setError("");
    try {
      const dates = dateRangeTimestamps(range.from, range.to);
      setTable(
        await fetchManagerOrders(managerSession, {
          page,
          pageSize: 20,
          search,
          status,
          warehouseId: warehouseId === "all" ? "" : warehouseId,
          ...dates,
          sort,
          direction,
        }),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load orders");
    } finally {
      setTableLoading(false);
    }
  }, [
    managerSession,
    page,
    search,
    status,
    warehouseId,
    range,
    rangeIsValid,
    sort,
    direction,
  ]);

  const loadAnalytics = useCallback(async () => {
    if (!managerSession) return;
    if (!rangeIsValid) {
      setAnalytics(null);
      setAnalyticsLoading(false);
      setAnalyticsError("");
      return;
    }
    setAnalyticsLoading(true);
    setAnalyticsError("");
    try {
      const dates = dateRangeTimestamps(range.from, range.to);
      setAnalytics(
        await fetchManagerOrderAnalytics(managerSession, dates.from, dates.to),
      );
    } catch (e) {
      setAnalyticsError(
        e instanceof Error ? e.message : "Unable to load order analytics",
      );
    } finally {
      setAnalyticsLoading(false);
    }
  }, [managerSession, range, rangeIsValid]);

  useEffect(() => {
    void loadTable();
  }, [loadTable]);
  useEffect(() => {
    void loadAnalytics();
  }, [loadAnalytics]);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPage(1);
      setSearch(query.trim());
    }, 300);
    return () => window.clearTimeout(timer);
  }, [query]);
  useEffect(
    () => () => {
      if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
    },
    [],
  );

  const chartStatus = useMemo(
    () =>
      analytics?.statusDistribution.map((item) => ({
        ...item,
        name: statusNames[item.name] ?? item.name,
      })) ?? [],
    [analytics],
  );
  if (!hydrated || !managerHydrated || !managerSession) return null;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-4 py-7 sm:px-6 lg:px-8">
      <header className="orders-enter flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-primary text-sm font-medium">
            Warehouse management
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">
            Customer orders
          </h1>
          <p className="text-muted-foreground mt-2 text-sm">
            Review orders across customers, track fulfillment, and monitor sales
            performance.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2 rounded-xl border bg-card p-3">
          <CalendarDays className="text-primary mb-2 size-4" />
          <label className="grid gap-1 text-xs font-medium text-muted-foreground">
            From
            <input
              aria-label="Analytics start date"
              type="date"
              value={range.from}
              max={range.to || undefined}
              onChange={(e) => {
                setRange((v) => ({ ...v, from: e.target.value }));
                setPage(1);
              }}
              className="bg-background text-foreground h-9 rounded-md border px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </label>
          <label className="grid gap-1 text-xs font-medium text-muted-foreground">
            To
            <input
              aria-label="Analytics end date"
              type="date"
              value={range.to}
              min={range.from || undefined}
              onChange={(e) => {
                setRange((v) => ({ ...v, to: e.target.value }));
                setPage(1);
              }}
              className="bg-background text-foreground h-9 rounded-md border px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </label>
        </div>
      </header>

      {(rangeError || analyticsError) && (
        <div
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
        >
          {rangeError || analyticsError}
        </div>
      )}
      <section
        aria-label="Order performance metrics"
        className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
      >
        <Metric
          label="Total orders"
          value={analytics?.totalOrders ?? 0}
          detail="Orders in selected range"
          loading={analyticsLoading}
          icon={ShoppingBag}
          index={0}
        />
        <Metric
          label="Order value"
          value={analytics?.totalRevenue ?? 0}
          detail="Gross order value"
          loading={analyticsLoading}
          icon={TrendingUp}
          index={1}
          currency
        />
        <Metric
          label="Pending"
          value={analytics?.pendingOrders ?? 0}
          detail="Awaiting payment"
          loading={analyticsLoading}
          icon={Clock3}
          index={2}
        />
        <Metric
          label="Processing"
          value={analytics?.processingOrders ?? 0}
          detail="Confirmed or backordered"
          loading={analyticsLoading}
          icon={RotateCcw}
          index={3}
        />
        <Metric
          label="Delivered"
          value={analytics?.deliveredOrders ?? 0}
          detail="Fulfilled orders"
          loading={analyticsLoading}
          icon={PackageCheck}
          index={4}
        />
        <Metric
          label="Cancelled"
          value={analytics?.cancelledOrders ?? 0}
          detail="Cancelled orders"
          loading={analyticsLoading}
          icon={XCircle}
          index={5}
        />
      </section>

      <section
        className="grid gap-4 xl:grid-cols-2"
        aria-label="Order analytics charts"
      >
        <Card className="orders-enter">
          <CardHeader>
            <CardTitle>Orders and revenue over time</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              {analyticsLoading ? (
                <ChartSkeleton />
              ) : !analytics?.trends.length ? (
                <EmptyChart />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={analytics.trends}
                    margin={{ top: 8, right: 8, bottom: 2, left: 0 }}
                  >
                    <CartesianGrid
                      stroke="var(--border)"
                      strokeDasharray="3 5"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="date"
                      tickFormatter={shortDate}
                      minTickGap={24}
                      tick={axisTick}
                    />
                    <YAxis
                      yAxisId="orders"
                      allowDecimals={false}
                      width={38}
                      tick={axisTick}
                    />
                    <YAxis
                      yAxisId="revenue"
                      orientation="right"
                      width={62}
                      tick={axisTick}
                      tickFormatter={formatINRCompact}
                    />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      labelStyle={{
                        color: "var(--foreground)",
                        fontWeight: 600,
                      }}
                      labelFormatter={(label) => shortDate(String(label))}
                      formatter={(value, name) => [
                        name === "revenue"
                          ? formatINR(Number(value))
                          : Number(value).toLocaleString("en-IN"),
                        name === "revenue" ? "Revenue" : "Orders",
                      ]}
                    />
                    <Line
                      yAxisId="orders"
                      dataKey="orders"
                      name="Orders"
                      stroke="#3286c7"
                      strokeWidth={2.5}
                      dot={false}
                      activeDot={{ r: 4 }}
                      isAnimationActive
                      animationDuration={650}
                    />
                    <Line
                      yAxisId="revenue"
                      dataKey="revenue"
                      name="Revenue"
                      stroke="#256d50"
                      strokeWidth={2.5}
                      dot={false}
                      activeDot={{ r: 4 }}
                      isAnimationActive
                      animationDuration={650}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
            <div className="mt-3 flex justify-center gap-5 text-xs">
              <LegendDot color="#3286c7" label="Orders" />
              <LegendDot color="#256d50" label="Revenue" />
            </div>
          </CardContent>
        </Card>
        <Card className="orders-enter">
          <CardHeader>
            <CardTitle>Order status distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative h-48">
              {analyticsLoading ? (
                <ChartSkeleton />
              ) : !chartStatus.length ? (
                <EmptyChart />
              ) : (
                <>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={chartStatus}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={58}
                        outerRadius={82}
                        paddingAngle={3}
                        isAnimationActive
                        animationDuration={650}
                      >
                        {chartStatus.map((item, i) => (
                          <Cell
                            key={item.name}
                            fill={
                              statusColors[item.name] ??
                              chartColors[i % chartColors.length]
                            }
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={tooltipStyle}
                        formatter={(value, name) => [
                          `${Number(value).toLocaleString("en-IN")} orders`,
                          name,
                        ]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-2xl font-semibold tabular-nums">
                      {(analytics?.totalOrders ?? 0).toLocaleString("en-IN")}
                    </span>
                    <span className="text-muted-foreground text-[11px]">
                      total orders
                    </span>
                  </div>
                </>
              )}
            </div>
            {!analyticsLoading && chartStatus.length > 0 && (
              <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2 border-t pt-3 sm:grid-cols-3">
                {chartStatus.map((item, i) => {
                  const total = analytics?.totalOrders ?? 0;
                  return (
                    <div
                      key={item.name}
                      className="flex min-w-0 items-center gap-2 text-xs"
                    >
                      <span
                        className="size-2 shrink-0 rounded-full"
                        style={{
                          backgroundColor:
                            statusColors[item.name] ??
                            chartColors[i % chartColors.length],
                        }}
                      />
                      <span
                        className="min-w-0 flex-1 truncate text-muted-foreground"
                        title={item.name}
                      >
                        {item.name}
                      </span>
                      <span className="font-medium tabular-nums">
                        {item.value.toLocaleString("en-IN")}{" "}
                        <span className="text-muted-foreground">
                          ({total ? Math.round((item.value / total) * 100) : 0}
                          %)
                        </span>
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
        <Card className="orders-enter">
          <CardHeader>
            <CardTitle>Top products by quantity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              {analyticsLoading ? (
                <ChartSkeleton />
              ) : !analytics?.topProducts.length ? (
                <EmptyChart />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={analytics.topProducts}
                    layout="vertical"
                    margin={{ left: 4, right: 18, top: 4, bottom: 4 }}
                    barCategoryGap="24%"
                  >
                    <CartesianGrid
                      stroke="var(--border)"
                      strokeDasharray="3 5"
                      horizontal={false}
                    />
                    <XAxis
                      type="number"
                      allowDecimals={false}
                      tick={axisTick}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={150}
                      tick={<ProductAxisTick />}
                    />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      formatter={(value) => [
                        `${Number(value).toLocaleString("en-IN")} units`,
                        "Quantity",
                      ]}
                    />
                    <Bar
                      dataKey="quantity"
                      name="Units sold"
                      fill="#256d50"
                      radius={[0, 5, 5, 0]}
                      isAnimationActive
                      animationDuration={650}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
            <p className="text-muted-foreground mt-2 text-center text-xs">
              Units sold in selected date range
            </p>
          </CardContent>
        </Card>
        <Card className="orders-enter">
          <CardHeader>
            <CardTitle>Orders by warehouse</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              {analyticsLoading ? (
                <ChartSkeleton />
              ) : !analytics?.warehouses.length ? (
                <EmptyChart />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={analytics.warehouses}
                    layout="vertical"
                    margin={{ left: 4, right: 18, top: 4, bottom: 4 }}
                    barCategoryGap="28%"
                  >
                    <CartesianGrid
                      stroke="var(--border)"
                      strokeDasharray="3 5"
                      horizontal={false}
                    />
                    <XAxis
                      type="number"
                      allowDecimals={false}
                      tick={axisTick}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={130}
                      tick={<WarehouseAxisTick />}
                    />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      formatter={(value) => [
                        `${Number(value).toLocaleString("en-IN")} orders`,
                        "Orders",
                      ]}
                    />
                    <Bar
                      dataKey="count"
                      name="Orders"
                      fill="#3286c7"
                      radius={[0, 5, 5, 0]}
                      isAnimationActive
                      animationDuration={650}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>
      </section>

      <Card className="orders-enter">
        <CardHeader>
          <CardTitle>All orders</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-[minmax(220px,1fr)_180px_220px_150px_140px]">
            <label className="relative">
              <Search className="text-muted-foreground absolute left-3 top-1/2 size-4 -translate-y-1/2" />
              <input
                aria-label="Search order ID or customer"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search order ID or customer"
                className="bg-background h-10 w-full rounded-md border pl-9 pr-3 text-sm"
              />
            </label>
            <select
              aria-label="Filter by status"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
              className="bg-background h-10 rounded-md border px-3 text-sm"
            >
              <option value="all">All statuses</option>
              {Object.entries(statusNames).map(([key, name]) => (
                <option key={key} value={key}>
                  {name}
                </option>
              ))}
            </select>
            <select
              aria-label="Filter by warehouse"
              value={warehouseId}
              onChange={(e) => {
                setWarehouseId(e.target.value);
                setPage(1);
              }}
              className="bg-background h-10 rounded-md border px-3 text-sm"
            >
              <option value="all">All warehouses</option>
              {table?.warehouses.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.name} · {warehouse.city}
                </option>
              ))}
            </select>
            <select
              aria-label="Sort orders"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="bg-background h-10 rounded-md border px-3 text-sm"
            >
              <option value="date">Order date</option>
              <option value="value">Order value</option>
              <option value="status">Status</option>
            </select>
            <Button
              variant="outline"
              onClick={() =>
                setDirection((v) => (v === "desc" ? "asc" : "desc"))
              }
            >
              <ArrowDownUp className="size-4" />
              {direction === "desc" ? "Descending" : "Ascending"}
            </Button>
          </div>
          {error && (
            <div
              role="alert"
              className="rounded-lg border border-destructive/40 p-3 text-sm text-destructive"
            >
              {error}
              <Button
                variant="outline"
                size="sm"
                className="ml-3"
                onClick={() => void loadTable()}
              >
                Retry
              </Button>
            </div>
          )}
          <div className="max-h-[70vh] overflow-auto rounded-lg border">
            <table className="w-full min-w-[780px] text-left text-sm">
              <thead className="sticky top-0 z-10 bg-muted text-muted-foreground shadow-sm">
                <tr>
                  {[
                    "Order",
                    "Customer",
                    "Warehouse",
                    "Order date",
                    "Total",
                    "Status",
                    "Details",
                  ].map((title) => (
                    <th
                      key={title}
                      className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wide"
                    >
                      {title}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/70">
                {tableLoading ? (
                  Array.from({ length: 5 }, (_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 7 }, (_, j) => (
                        <td key={j} className="px-4 py-4">
                          <span className="block h-4 animate-pulse rounded bg-muted" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : !table?.items.length ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-12 text-center text-muted-foreground"
                    >
                      {error
                        ? "Orders could not be loaded."
                        : "No orders match these filters."}
                    </td>
                  </tr>
                ) : (
                  table.items.map((order) => {
                    const warehouses = [
                      ...new Map(
                        order.allocations.map((a) => [
                          a.inventory.warehouse.id,
                          a.inventory.warehouse.name,
                        ]),
                      ).values(),
                    ];
                    const statusLabel =
                      statusNames[order.status] ?? order.status;
                    const statusTone =
                      order.status === "CANCELLED"
                        ? "bg-red-500/10 text-red-700 ring-red-600/20 dark:text-red-300"
                        : order.status === "FULFILLED"
                          ? "bg-emerald-500/10 text-emerald-700 ring-emerald-600/20 dark:text-emerald-300"
                          : order.status === "PENDING_PAYMENT"
                            ? "bg-amber-500/10 text-amber-700 ring-amber-600/20 dark:text-amber-300"
                            : "bg-blue-500/10 text-blue-700 ring-blue-600/20 dark:text-blue-300";
                    return (
                      <tr
                        key={order.id}
                        className="transition-colors duration-150 hover:bg-primary/[0.035]"
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <span
                              className="font-mono text-xs font-medium"
                              title={order.id}
                            >
                              {order.id.slice(0, 8)}…
                            </span>
                            <button
                              type="button"
                              aria-label={`Copy order ID ${order.id}`}
                              title={
                                copiedOrderId === order.id
                                  ? "Copied"
                                  : "Copy order ID"
                              }
                              className="text-muted-foreground hover:text-primary rounded p-1 transition-colors"
                              onClick={() => {
                                void navigator.clipboard
                                  .writeText(order.id)
                                  .then(() => {
                                    setCopiedOrderId(order.id);
                                    window.setTimeout(
                                      () => setCopiedOrderId(""),
                                      1500,
                                    );
                                  })
                                  .catch(() =>
                                    setError("Could not copy the order ID."),
                                  );
                              }}
                            >
                              <span className="sr-only">Copy order ID</span>
                              {copiedOrderId === order.id ? (
                                <Check className="size-3.5" />
                              ) : (
                                <Clipboard className="size-3.5" />
                              )}
                            </button>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <p
                            className="max-w-48 truncate font-semibold"
                            title={order.user.name}
                          >
                            {order.user.name}
                          </p>
                          <p
                            className="text-muted-foreground mt-0.5 max-w-48 truncate text-xs"
                            title={order.user.email}
                          >
                            {order.user.email}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className="block max-w-40 truncate text-sm"
                            title={warehouses.join(", ")}
                          >
                            {warehouses.join(", ") || (
                              <span className="text-muted-foreground">
                                Unassigned
                              </span>
                            )}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm">
                          {new Intl.DateTimeFormat("en-IN", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          }).format(new Date(order.createdAt))}
                        </td>
                        <td className="px-4 py-3 font-semibold tabular-nums whitespace-nowrap">
                          {formatINR(order.totalPrice)}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${statusTone}`}
                          >
                            {statusLabel}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-primary/20 text-primary hover:bg-primary hover:text-primary-foreground active:scale-[0.98]"
                            onClick={() => openOrder(order)}
                          >
                            View details
                          </Button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-muted-foreground text-sm">
              {table ? (
                <>
                  Showing{" "}
                  <span className="text-foreground font-medium">
                    {table.pagination.total
                      ? (table.pagination.page - 1) *
                          table.pagination.pageSize +
                        1
                      : 0}
                    –
                    {Math.min(
                      table.pagination.page * table.pagination.pageSize,
                      table.pagination.total,
                    )}
                  </span>{" "}
                  of{" "}
                  <span className="text-foreground font-medium">
                    {table.pagination.total.toLocaleString("en-IN")}
                  </span>{" "}
                  orders{" "}
                  <span className="hidden sm:inline">
                    · Page {table.pagination.page} of{" "}
                    {Math.max(table.pagination.totalPages, 1)}
                  </span>
                </>
              ) : (
                "Loading orders…"
              )}
            </p>
            <div className="flex w-full gap-2 sm:w-auto">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 sm:flex-none"
                onClick={() => setPage((v) => Math.max(1, v - 1))}
                disabled={page <= 1 || tableLoading}
              >
                <ChevronLeft className="size-4" />
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1 sm:flex-none"
                onClick={() =>
                  setPage((v) =>
                    Math.min(table?.pagination.totalPages ?? v, v + 1),
                  )
                }
                disabled={
                  tableLoading || page >= (table?.pagination.totalPages ?? 1)
                }
              >
                Next
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={detailOpen}
        onOpenChange={(open) => {
          if (open) setDetailOpen(true);
          else closeOrder();
        }}
      >
        {selected && (
          <DialogContent
            showClose={false}
            aria-describedby="order-detail-description"
            className="orders-dialog-content"
          >
            <DialogHeader className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-primary text-xs font-semibold uppercase tracking-wide">
                  Order details
                </p>
                <DialogTitle className="mt-1 break-all font-mono text-base sm:text-lg">
                  {selected.id}
                </DialogTitle>
                <DialogDescription id="order-detail-description">
                  Review customer, products, fulfillment and order timestamps.
                </DialogDescription>
              </div>
              <button
                type="button"
                aria-label="Close order details"
                onClick={closeOrder}
                className="text-muted-foreground hover:bg-muted hover:text-foreground -mr-2 -mt-1 grid size-9 shrink-0 place-items-center rounded-full transition-colors"
              >
                <X className="size-4" />
              </button>
            </DialogHeader>
            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain p-4 sm:p-6">
              <section className="rounded-xl border bg-muted/20 p-4">
                <h3 className="text-sm font-semibold">Customer</h3>
                <p className="mt-2 text-sm font-medium">{selected.user.name}</p>
                <p className="text-muted-foreground text-sm">
                  {selected.user.email}
                </p>
                {(selected.shippingPhone || selected.shippingAddress1) && (
                  <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                    {[
                      selected.shippingPhone,
                      selected.shippingAddress1,
                      selected.shippingAddress2,
                      selected.shippingCity,
                      selected.shippingRegion,
                      selected.shippingPostalCode,
                      selected.shippingCountry,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                )}
              </section>
              <section>
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">Products</h3>
                  <span className="text-muted-foreground text-xs">
                    {selected.items.length || 1} item
                    {(selected.items.length || 1) === 1 ? "" : "s"}
                  </span>
                </div>
                <div className="mt-2 divide-y rounded-xl border">
                  {(selected.items.length
                    ? selected.items
                    : [
                        {
                          id: selected.id,
                          product: selected.product,
                          quantity: selected.quantity,
                          unitPrice: selected.unitPrice,
                          totalPrice: selected.totalPrice,
                        },
                      ]
                  ).map((item) => (
                    <div
                      key={item.id}
                      className="flex flex-wrap items-center justify-between gap-3 p-3 sm:p-4"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="break-words text-sm font-semibold">
                          {item.product.name}
                        </p>
                        <p className="text-muted-foreground mt-1 text-xs">
                          SKU {item.product.sku} · Qty {item.quantity} ·{" "}
                          {formatINR(item.unitPrice)} each
                        </p>
                      </div>
                      <p className="text-sm font-semibold tabular-nums">
                        {formatINR(item.totalPrice)}
                      </p>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between border-b px-1 py-3 text-sm">
                  <span className="text-muted-foreground">Total amount</span>
                  <span className="text-base font-bold tabular-nums">
                    {formatINR(selected.totalPrice)}
                  </span>
                </div>
              </section>
              <section>
                <h3 className="text-sm font-semibold">Warehouse allocation</h3>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {selected.allocations.length ? (
                    selected.allocations.map((allocation, i) => (
                      <div
                        key={`${allocation.inventory.warehouse.id}-${i}`}
                        className="rounded-xl border p-3"
                      >
                        <p className="text-sm font-semibold">
                          {allocation.inventory.warehouse.name}
                        </p>
                        <p className="text-muted-foreground mt-1 text-xs">
                          {allocation.inventory.warehouse.city} ·{" "}
                          {allocation.inventory.warehouse.pincode}
                        </p>
                        <p className="text-primary mt-2 text-xs font-medium">
                          {allocation.quantity} units allocated
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="text-muted-foreground rounded-xl border border-dashed p-4 text-sm">
                      No warehouse allocation recorded
                    </p>
                  )}
                </div>
              </section>
              <section>
                <h3 className="text-sm font-semibold">Order timeline</h3>
                <dl className="mt-2 grid gap-3 rounded-xl border p-4 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-muted-foreground text-xs">Status</dt>
                    <dd className="mt-1 font-medium">
                      {statusNames[selected.status] ?? selected.status}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground text-xs">Placed</dt>
                    <dd className="mt-1">
                      {new Date(selected.createdAt).toLocaleString("en-IN")}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground text-xs">
                      Last updated
                    </dt>
                    <dd className="mt-1">
                      {new Date(selected.updatedAt).toLocaleString("en-IN")}
                    </dd>
                  </div>
                  {selected.shipments.map((shipment, i) => (
                    <div key={i}>
                      <dt className="text-muted-foreground text-xs">
                        Shipment · {shipment.status}
                      </dt>
                      <dd className="mt-1">
                        {shipment.deliveredAt
                          ? new Date(shipment.deliveredAt).toLocaleString(
                              "en-IN",
                            )
                          : shipment.shippedAt
                            ? new Date(shipment.shippedAt).toLocaleString(
                                "en-IN",
                              )
                            : new Date(shipment.createdAt).toLocaleString(
                                "en-IN",
                              )}
                      </dd>
                    </div>
                  ))}
                </dl>
              </section>
            </div>
            <div className="flex shrink-0 items-center justify-between gap-3 border-t bg-background px-4 py-3 sm:px-6">
              <span className="text-muted-foreground text-xs">
                Read-only order record
              </span>
              <Button variant="outline" onClick={closeOrder}>
                Close
              </Button>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </main>
  );
}

const axisTick = { fill: "var(--muted-foreground)", fontSize: 11 };
const tooltipStyle = {
  borderRadius: 12,
  border: "1px solid var(--border)",
  backgroundColor: "var(--popover)",
  color: "var(--popover-foreground)",
  boxShadow: "0 10px 30px rgba(15, 23, 42, 0.12)",
};

function ProductAxisTick({
  x = 0,
  y = 0,
  payload,
}: {
  x?: number;
  y?: number;
  payload?: { value?: string };
}) {
  const name = String(payload?.value ?? "");
  const label = name.length > 23 ? `${name.slice(0, 21)}…` : name;
  return (
    <g>
      <text
        x={x}
        y={y}
        dy={4}
        textAnchor="end"
        fill="var(--muted-foreground)"
        fontSize={11}
      >
        <title>{name}</title>
        {label}
      </text>
    </g>
  );
}

function WarehouseAxisTick({
  x = 0,
  y = 0,
  payload,
}: {
  x?: number;
  y?: number;
  payload?: { value?: string };
}) {
  const name = String(payload?.value ?? "");
  const label = name.length > 18 ? `${name.slice(0, 16)}…` : name;
  return (
    <g>
      <text
        x={x}
        y={y}
        dy={4}
        textAnchor="end"
        fill="var(--muted-foreground)"
        fontSize={11}
      >
        <title>{name}</title>
        {label}
      </text>
    </g>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="text-muted-foreground inline-flex items-center gap-2">
      <span
        className="size-2.5 rounded-full"
        style={{ backgroundColor: color }}
      />
      {label}
    </span>
  );
}

function ChartSkeleton() {
  return <div className="h-full w-full animate-pulse rounded-lg bg-muted/70" />;
}
function EmptyChart() {
  return (
    <div className="text-muted-foreground flex h-full items-center justify-center rounded-xl border border-dashed bg-muted/10 text-sm">
      No order data for this date range
    </div>
  );
}

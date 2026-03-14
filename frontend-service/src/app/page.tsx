"use client";

import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import {
  AlertTriangle,
  Boxes,
  CheckCircle2,
  ClipboardList,
  Gauge,
  ShieldCheck,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { InventoryTable } from "@/components/InventoryTable";
import { RecentReorders } from "@/components/RecentReorders";
import { RiskItemsPanel } from "@/components/RiskItemsPanel";
import {
  fetchDashboardSummary,
  fetchInventory,
  verifyManagerAccess,
  type DashboardSummary,
  type InventoryItem,
  type ManagerSession,
} from "@/lib/api";

const StockPerWarehouseChart = dynamic(
  () =>
    import("@/components/StockPerWarehouseChart").then(
      (mod) => mod.StockPerWarehouseChart,
    ),
  { ssr: false },
);

const InventoryHealthPieChart = dynamic(
  () =>
    import("@/components/InventoryHealthPieChart").then(
      (mod) => mod.InventoryHealthPieChart,
    ),
  { ssr: false },
);

const ReorderStatusPieChart = dynamic(
  () =>
    import("@/components/ReorderStatusPieChart").then(
      (mod) => mod.ReorderStatusPieChart,
    ),
  { ssr: false },
);

const WarehouseUtilizationChart = dynamic(
  () =>
    import("@/components/WarehouseUtilizationChart").then(
      (mod) => mod.WarehouseUtilizationChart,
    ),
  { ssr: false },
);

const SESSION_KEY = "warehouse_manager_session";

const getDashboardSnapshot = (
  summaryData: DashboardSummary,
  inventoryData: InventoryItem[],
) => JSON.stringify({ summaryData, inventoryData });

export default function Home() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [inventories, setInventories] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [managerSession, setManagerSession] = useState<ManagerSession | null>(
    null,
  );
  const [email, setEmail] = useState("");
  const [accessKey, setAccessKey] = useState("");
  const latestSnapshotRef = useRef<string>("");

  useEffect(() => {
    const stored = window.localStorage.getItem(SESSION_KEY);
    if (!stored) return;

    try {
      const parsed = JSON.parse(stored) as ManagerSession;
      if (parsed.email && parsed.accessKey) {
        setManagerSession(parsed);
      }
    } catch {
      window.localStorage.removeItem(SESSION_KEY);
    }
  }, []);

  useEffect(() => {
    if (!managerSession) {
      latestSnapshotRef.current = "";
      setLoading(false);
      return;
    }

    let mounted = true;

    const loadDashboard = async (showLoading: boolean) => {
      try {
        if (showLoading) {
          setLoading(true);
        }

        await verifyManagerAccess(managerSession);
        const [summaryData, inventoryData] = await Promise.all([
          fetchDashboardSummary(managerSession),
          fetchInventory(managerSession),
        ]);

        if (!mounted) return;

        const nextSnapshot = getDashboardSnapshot(summaryData, inventoryData);

        if (latestSnapshotRef.current !== nextSnapshot) {
          latestSnapshotRef.current = nextSnapshot;
          setSummary(summaryData);
          setInventories(inventoryData);
        }

        setError(null);
      } catch (err) {
        if (!mounted) return;

        setError(err instanceof Error ? err.message : "No data available");
      } finally {
        if (mounted && showLoading) {
          setLoading(false);
        }
      }
    };

    void loadDashboard(true);
    const pollId = setInterval(() => {
      void loadDashboard(false);
    }, 15000);

    return () => {
      mounted = false;
      clearInterval(pollId);
    };
  }, [managerSession]);

  const stats = useMemo(
    () => [
      {
        title: "Total SKUs",
        value: summary?.totalProducts ?? 0,
        description: "Active products under manager supervision",
        icon: Boxes,
      },
      {
        title: "Open Reorders",
        value: summary?.openOrders ?? 0,
        description: "Pending replenishment tasks",
        icon: ClipboardList,
      },
      {
        title: "Fill Rate",
        value: `${summary?.fillRate ?? 0}%`,
        description: "Available units vs total allocated units",
        icon: Gauge,
      },
      {
        title: "Critical Alerts",
        value: summary?.criticalStockCount ?? 0,
        description: "SKUs below 50% of reorder threshold",
        icon: AlertTriangle,
        danger: (summary?.criticalStockCount ?? 0) > 0,
      },
      {
        title: "Completed Reorders",
        value: summary?.completedOrders ?? 0,
        description: "Reorders completed this cycle",
        icon: CheckCircle2,
      },
    ],
    [summary],
  );

  const handleManagerLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const session = {
      email: email.trim(),
      accessKey: accessKey.trim(),
    };

    try {
      setLoading(true);
      await verifyManagerAccess(session);
      setManagerSession(session);
      window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Invalid manager credentials",
      );
      setManagerSession(null);
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    window.localStorage.removeItem(SESSION_KEY);
    setManagerSession(null);
    setSummary(null);
    setInventories([]);
    latestSnapshotRef.current = "";
  };

  if (!managerSession) {
    return (
      <main className="bg-muted/20 flex min-h-screen items-center justify-center p-6">
        <Card className="w-full max-w-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5" /> Warehouse Manager Access
            </CardTitle>
            <CardDescription>
              This SaaS dashboard is restricted to the configured warehouse
              manager account.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleManagerLogin} className="space-y-4">
              <div className="space-y-1">
                <label htmlFor="manager-email" className="text-sm font-medium">
                  Manager Email
                </label>
                <input
                  id="manager-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
                  required
                />
              </div>
              <div className="space-y-1">
                <label
                  htmlFor="manager-access-key"
                  className="text-sm font-medium"
                >
                  Access Key
                </label>
                <input
                  id="manager-access-key"
                  type="password"
                  value={accessKey}
                  onChange={(event) => setAccessKey(event.target.value)}
                  className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
                  required
                />
              </div>
              {error ? (
                <p className="text-destructive text-sm">{error}</p>
              ) : null}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Verifying..." : "Open Dashboard"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <div className="from-background to-muted/30 min-h-screen bg-gradient-to-b">
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-8">
        <section className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">
              Warehouse Manager SaaS Command Center
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              15-second backend sync that only updates the dashboard when data
              changes.
            </p>
          </div>
          <Button variant="outline" onClick={logout}>
            Sign out
          </Button>
        </section>

        {error ? (
          <Card className="border-destructive/40 bg-destructive/5">
            <CardHeader>
              <CardTitle>Unable to load dashboard</CardTitle>
              <CardDescription>{error}</CardDescription>
            </CardHeader>
          </Card>
        ) : null}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {stats.map((item) => (
            <Card
              key={item.title}
              className={item.danger ? "border-destructive/40" : ""}
            >
              <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
                <CardTitle className="text-sm font-medium">
                  {item.title}
                </CardTitle>
                <item.icon
                  className={`h-4 w-4 ${
                    item.danger ? "text-destructive" : "text-muted-foreground"
                  }`}
                />
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-semibold">
                  {loading
                    ? "..."
                    : typeof item.value === "number"
                      ? item.value.toLocaleString()
                      : item.value}
                </p>
                <p className="text-muted-foreground mt-1 text-xs">
                  {item.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </section>

        <section className="grid gap-4 xl:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Inventory Health</CardTitle>
              <CardDescription>
                Healthy vs low vs critical SKU positions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <InventoryHealthPieChart
                data={summary?.inventoryHealthBreakdown ?? []}
                loading={loading}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Reorder Status Mix</CardTitle>
              <CardDescription>
                Pending, completed, and cancelled requests
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ReorderStatusPieChart
                data={summary?.reorderStatusBreakdown ?? []}
                loading={loading}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Top SKU Risks</CardTitle>
              <CardDescription>
                Prioritized by deficit against reorder target
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RiskItemsPanel
                items={summary?.topRiskItems ?? []}
                loading={loading}
              />
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-4 lg:grid-cols-5">
          <Card className="lg:col-span-3">
            <CardHeader>
              <CardTitle>Inventory by SKU</CardTitle>
              <CardDescription>
                Real-time stock status with reorder intelligence
              </CardDescription>
            </CardHeader>
            <CardContent>
              <InventoryTable inventories={inventories} loading={loading} />
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Stock by Warehouse</CardTitle>
              <CardDescription>
                Total available units by warehouse
              </CardDescription>
            </CardHeader>
            <CardContent>
              <StockPerWarehouseChart
                data={summary?.stockPerWarehouse ?? []}
                loading={loading}
              />
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-4 xl:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Warehouse Utilization</CardTitle>
              <CardDescription>
                Stacked available vs reserved capacity footprint
              </CardDescription>
            </CardHeader>
            <CardContent>
              <WarehouseUtilizationChart
                data={summary?.warehouseUtilization ?? []}
                loading={loading}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent Reorder Activity</CardTitle>
              <CardDescription>
                Latest replenishment requests and execution states
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RecentReorders
                data={summary?.recentReorders ?? []}
                loading={loading}
              />
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
}

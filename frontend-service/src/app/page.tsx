"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import {
  AlertTriangle,
  Boxes,
  ClipboardList,
  PackageSearch,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { InventoryTable } from "@/components/InventoryTable";
import { RecentReorders } from "@/components/RecentReorders";
import {
  fetchDashboardSummary,
  fetchInventory,
  type DashboardSummary,
  type InventoryItem,
} from "@/lib/api";

const StockPerWarehouseChart = dynamic(
  () =>
    import("@/components/StockPerWarehouseChart").then(
      (mod) => mod.StockPerWarehouseChart,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="bg-muted/40 h-80 w-full animate-pulse rounded-md" />
    ),
  },
);

const defaultSummary: DashboardSummary = {
  totalProducts: 0,
  openOrders: 0,
  lowStockCount: 0,
  totalUnits: 0,
  stockPerWarehouse: [],
  recentReorders: [],
};

export default function Home() {
  const [summary, setSummary] = useState<DashboardSummary>(defaultSummary);
  const [inventories, setInventories] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        setLoading(true);
        const [summaryData, inventoryData] = await Promise.all([
          fetchDashboardSummary(),
          fetchInventory(),
        ]);
        setSummary(summaryData);
        setInventories(inventoryData);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Unable to load dashboard data. Check API availability.",
        );
      } finally {
        setLoading(false);
      }
    };

    loadDashboard();
  }, []);

  const stats = useMemo(
    () => [
      {
        title: "Active SKUs",
        value: summary.totalProducts,
        description: "Products currently available in the catalog",
        icon: PackageSearch,
      },
      {
        title: "Units in Stock",
        value: summary.totalUnits,
        description: "Aggregate units across all warehouses",
        icon: Boxes,
      },
      {
        title: "Open Reorders",
        value: summary.openOrders,
        description: "Replenishment requests awaiting completion",
        icon: ClipboardList,
      },
      {
        title: "Low Stock Alerts",
        value: summary.lowStockCount,
        description: "SKUs at or below reorder threshold",
        icon: AlertTriangle,
        danger: summary.lowStockCount > 0,
      },
    ],
    [summary],
  );

  return (
    <div className="from-background to-muted/30 min-h-screen bg-gradient-to-b">
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-8">
        <section>
          <h1 className="text-3xl font-semibold tracking-tight">
            Supply Chain Control Tower
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Unified visibility of inventory health, warehouse utilization, and
            reordering.
          </p>
        </section>

        {error ? (
          <Card className="border-destructive/40 bg-destructive/5">
            <CardHeader>
              <CardTitle>Unable to load dashboard</CardTitle>
              <CardDescription>{error}</CardDescription>
            </CardHeader>
          </Card>
        ) : null}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
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
                  {loading ? "..." : item.value.toLocaleString()}
                </p>
                <p className="text-muted-foreground mt-1 text-xs">
                  {item.description}
                </p>
              </CardContent>
            </Card>
          ))}
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
              <InventoryTable inventories={inventories} />
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Warehouse Stock Distribution</CardTitle>
              <CardDescription>
                Total available units by warehouse
              </CardDescription>
            </CardHeader>
            <CardContent>
              <StockPerWarehouseChart data={summary.stockPerWarehouse} />
            </CardContent>
          </Card>
        </section>

        <section>
          <Card>
            <CardHeader>
              <CardTitle>Recent Reorder Activity</CardTitle>
              <CardDescription>
                Latest replenishment requests and their status
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RecentReorders data={summary.recentReorders} />
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
}

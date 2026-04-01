"use client";

import { type FormEvent, useEffect, useState } from "react";
import dynamic from "next/dynamic";
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
import { ManagerAccessCard } from "@/components/dashboard/ManagerAccessCard";
import { StatsGrid } from "@/components/dashboard/StatsGrid";
import { useDashboardData } from "@/hooks/useDashboardData";
import { useManagerSession } from "@/hooks/useManagerSession";
import { useAuthSession } from "@/hooks/useAuthSession";
import { useRouter } from "next/navigation";

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

export default function Home() {
  const router = useRouter();
  const { session: authSession, hydrated } = useAuthSession();
  const {
    managerSession,
    email,
    setEmail,
    accessKey,
    setAccessKey,
    authLoading,
    authError,
    login,
    logout,
  } = useManagerSession();

  const {
    summary,
    inventories,
    loading,
    error,
    stats,
    warehouseOptions,
    setError,
  } = useDashboardData(managerSession);

  const [warehouseFilter, setWarehouseFilter] = useState("all");
  const [stockStatusFilter, setStockStatusFilter] = useState<
    "all" | "healthy" | "low"
  >("all");
  useEffect(() => {
    if (!hydrated) return;
    if (authSession?.role === "user") {
      router.replace("/user");
    }
  }, [authSession, hydrated, router]);
  const handleManagerLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await login();
  };

  const handleLogout = () => {
    logout();
    setError(null);
  };
  if (!hydrated) {
    return null;
  }
  if (!managerSession) {
    return (
      <ManagerAccessCard
        email={email}
        accessKey={accessKey}
        loading={authLoading}
        error={authError}
        onEmailChange={setEmail}
        onAccessKeyChange={setAccessKey}
        onSubmit={handleManagerLogin}
      />
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
          <Button variant="outline" onClick={handleLogout}>
            Sign out
          </Button>
        </section>

        {error || authError ? (
          <Card className="border-destructive/40 bg-destructive/5">
            <CardHeader>
              <CardTitle>Unable to load dashboard</CardTitle>
              <CardDescription>{error ?? authError}</CardDescription>
            </CardHeader>
          </Card>
        ) : null}

        <StatsGrid stats={stats} loading={loading || authLoading} />

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
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle>Inventory by SKU</CardTitle>
                <CardDescription>
                  Real-time stock status with reorder intelligence
                </CardDescription>
              </div>

              <div className="flex flex-wrap gap-2">
                <select
                  className="border-input bg-background rounded-md border px-3 py-2 text-sm"
                  value={warehouseFilter}
                  onChange={(event) => setWarehouseFilter(event.target.value)}
                >
                  <option value="all">All Warehouses</option>
                  {warehouseOptions.map(([id, name]) => (
                    <option key={id} value={id}>
                      {name}
                    </option>
                  ))}
                </select>

                <select
                  className="border-input bg-background rounded-md border px-3 py-2 text-sm"
                  value={stockStatusFilter}
                  onChange={(event) =>
                    setStockStatusFilter(
                      event.target.value as "all" | "healthy" | "low",
                    )
                  }
                >
                  <option value="all">All Stock Status</option>
                  <option value="healthy">Healthy</option>
                  <option value="low">Low Stock</option>
                </select>
              </div>
            </CardHeader>

            <CardContent>
              <InventoryTable
                inventories={inventories}
                loading={loading}
                warehouseFilter={warehouseFilter}
                statusFilter={stockStatusFilter}
              />
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

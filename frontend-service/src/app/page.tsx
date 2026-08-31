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
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
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
    lastUpdated,
    refresh,
    setError,
  } = useDashboardData(managerSession);

  const [warehouseFilter, setWarehouseFilter] = useState("all");
  const [stockStatusFilter, setStockStatusFilter] = useState<
    "all" | "healthy" | "low"
  >("all");
  const [healthFilter, setHealthFilter] = useState("all");
  const [reorderMixFilter, setReorderMixFilter] = useState("all");
  const [riskWarehouseFilter, setRiskWarehouseFilter] = useState("all");
  const [stockWarehouseFilter, setStockWarehouseFilter] = useState("all");
  const [utilizationWarehouseFilter, setUtilizationWarehouseFilter] =
    useState("all");
  const [recentReorderFilter, setRecentReorderFilter] = useState("all");
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
        <DashboardHeader
          loading={loading || authLoading}
          lastUpdated={lastUpdated}
          hasActiveFilters={[
            warehouseFilter,
            stockStatusFilter,
            healthFilter,
            reorderMixFilter,
            riskWarehouseFilter,
            stockWarehouseFilter,
            utilizationWarehouseFilter,
            recentReorderFilter,
          ].some((filter) => filter !== "all")}
          onRefresh={refresh}
          onResetFilters={() => {
            setWarehouseFilter("all");
            setStockStatusFilter("all");
            setHealthFilter("all");
            setReorderMixFilter("all");
            setRiskWarehouseFilter("all");
            setStockWarehouseFilter("all");
            setUtilizationWarehouseFilter("all");
            setRecentReorderFilter("all");
          }}
        />

        <div className="flex justify-end">
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            Sign out
          </Button>
        </div>

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
          <Card className="flex h-[390px] flex-col overflow-hidden">
            <CardHeader className="shrink-0">
              <div className="flex items-start justify-between gap-3">
                <CardTitle>Inventory Health</CardTitle>
                <select
                  aria-label="Filter inventory health"
                  className="border-input bg-background rounded-md border px-2 py-1.5 text-xs"
                  value={healthFilter}
                  onChange={(event) => setHealthFilter(event.target.value)}
                >
                  <option value="all">All states</option>
                  <option value="healthy">Healthy</option>
                  <option value="low">Low</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
              <CardDescription>
                Healthy vs low vs critical SKU positions
              </CardDescription>
            </CardHeader>
            <CardContent className="min-h-0 flex-1">
              <InventoryHealthPieChart
                data={summary?.inventoryHealthBreakdown ?? []}
                loading={loading}
                statusFilter={healthFilter}
              />
            </CardContent>
          </Card>

          <Card className="flex h-[390px] flex-col overflow-hidden">
            <CardHeader className="shrink-0">
              <div className="flex items-start justify-between gap-3">
                <CardTitle>Reorder Status Mix</CardTitle>
                <select
                  aria-label="Filter reorder status mix"
                  className="border-input bg-background rounded-md border px-2 py-1.5 text-xs"
                  value={reorderMixFilter}
                  onChange={(event) => setReorderMixFilter(event.target.value)}
                >
                  <option value="all">All statuses</option>
                  <option value="pending">Pending</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
              <CardDescription>
                Pending, completed, and cancelled requests
              </CardDescription>
            </CardHeader>
            <CardContent className="min-h-0 flex-1">
              <ReorderStatusPieChart
                data={summary?.reorderStatusBreakdown ?? []}
                loading={loading}
                statusFilter={reorderMixFilter}
              />
            </CardContent>
          </Card>

          <Card className="flex h-[390px] flex-col overflow-hidden">
            <CardHeader className="shrink-0">
              <div className="flex items-start justify-between gap-3">
                <CardTitle>Top SKU Risks</CardTitle>
                <select
                  aria-label="Filter SKU risks by warehouse"
                  className="border-input bg-background max-w-32 rounded-md border px-2 py-1.5 text-xs"
                  value={riskWarehouseFilter}
                  onChange={(event) =>
                    setRiskWarehouseFilter(event.target.value)
                  }
                >
                  <option value="all">All warehouses</option>
                  {warehouseOptions.map(([id, name]) => (
                    <option key={id} value={id}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>
              <CardDescription>
                Prioritized by deficit against reorder target
              </CardDescription>
            </CardHeader>
            <CardContent className="min-h-0 flex-1">
              <RiskItemsPanel
                items={summary?.topRiskItems ?? []}
                loading={loading}
                warehouseFilter={riskWarehouseFilter}
              />
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-4 lg:grid-cols-5">
          <Card className="flex h-[560px] flex-col overflow-hidden lg:col-span-3">
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

            <CardContent className="min-h-0 flex-1">
              <InventoryTable
                inventories={inventories}
                loading={loading}
                warehouseFilter={warehouseFilter}
                statusFilter={stockStatusFilter}
              />
            </CardContent>
          </Card>

          <Card className="flex h-[560px] flex-col overflow-hidden lg:col-span-2">
            <CardHeader className="shrink-0">
              <div className="flex items-start justify-between gap-3">
                <CardTitle>Stock by Warehouse</CardTitle>
                <select
                  aria-label="Filter stock by warehouse"
                  className="border-input bg-background max-w-32 rounded-md border px-2 py-1.5 text-xs"
                  value={stockWarehouseFilter}
                  onChange={(event) =>
                    setStockWarehouseFilter(event.target.value)
                  }
                >
                  <option value="all">All warehouses</option>
                  {warehouseOptions.map(([id, name]) => (
                    <option key={id} value={id}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>
              <CardDescription>
                Total available units by warehouse
              </CardDescription>
            </CardHeader>
            <CardContent className="min-h-0 flex-1">
              <StockPerWarehouseChart
                data={summary?.stockPerWarehouse ?? []}
                loading={loading}
                warehouseFilter={stockWarehouseFilter}
              />
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-4 xl:grid-cols-2">
          <Card className="flex h-[460px] flex-col overflow-hidden">
            <CardHeader className="shrink-0">
              <div className="flex items-start justify-between gap-3">
                <CardTitle>Warehouse Utilization</CardTitle>
                <select
                  aria-label="Filter warehouse utilization"
                  className="border-input bg-background max-w-32 rounded-md border px-2 py-1.5 text-xs"
                  value={utilizationWarehouseFilter}
                  onChange={(event) =>
                    setUtilizationWarehouseFilter(event.target.value)
                  }
                >
                  <option value="all">All warehouses</option>
                  {warehouseOptions.map(([id, name]) => (
                    <option key={id} value={id}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>
              <CardDescription>
                Stacked available vs reserved capacity footprint
              </CardDescription>
            </CardHeader>
            <CardContent className="min-h-0 flex-1">
              <WarehouseUtilizationChart
                data={summary?.warehouseUtilization ?? []}
                loading={loading}
                warehouseFilter={utilizationWarehouseFilter}
              />
            </CardContent>
          </Card>

          <Card className="flex h-[460px] flex-col overflow-hidden">
            <CardHeader className="shrink-0">
              <div className="flex items-start justify-between gap-3">
                <CardTitle>Recent Reorder Activity</CardTitle>
                <select
                  aria-label="Filter recent reorders by status"
                  className="border-input bg-background rounded-md border px-2 py-1.5 text-xs"
                  value={recentReorderFilter}
                  onChange={(event) =>
                    setRecentReorderFilter(event.target.value)
                  }
                >
                  <option value="all">All statuses</option>
                  <option value="PENDING">Pending</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="CANCELLED">Cancelled</option>
                  <option value="FAILED">Failed</option>
                </select>
              </div>
              <CardDescription>
                Latest replenishment requests and execution states
              </CardDescription>
            </CardHeader>
            <CardContent className="min-h-0 flex-1">
              <RecentReorders
                data={summary?.recentReorders ?? []}
                loading={loading}
                statusFilter={recentReorderFilter}
              />
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
}

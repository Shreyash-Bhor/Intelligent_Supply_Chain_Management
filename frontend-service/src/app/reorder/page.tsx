"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthSession } from "@/hooks/useAuthSession";
import {
  fetchReorders,
  fetchInventory,
  updateReorderStatus,
  type InventoryItem,
  type ManagerSession,
  type StockReorder,
} from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const SESSION_KEY = "warehouse_manager_session";

export default function ReorderPage() {
  const router = useRouter();
  const { session: authSession, hydrated } = useAuthSession();
  const [session, setSession] = useState<ManagerSession | null>(null);
  const [inventoryLookup, setInventoryLookup] = useState<
    Record<string, InventoryItem>
  >({});
  const [reorders, setReorders] = useState<StockReorder[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warehouseFilter, setWarehouseFilter] = useState("all");
  const [reorderView, setReorderView] = useState<"current" | "history">(
    "current",
  );
  const [historyStatusFilter, setHistoryStatusFilter] = useState<
    "all" | "COMPLETED" | "CANCELLED"
  >("all");

  useEffect(() => {
    const stored = window.localStorage.getItem(SESSION_KEY);
    if (!stored) return;

    try {
      const parsed = JSON.parse(stored) as ManagerSession;
      if (parsed.email && parsed.accessKey) {
        setSession(parsed);
      }
    } catch {
      window.localStorage.removeItem(SESSION_KEY);
    }
  }, []);

  const loadData = useCallback(async () => {
    if (!session) return;

    try {
      setLoading(true);
      const [reorderData, inventoryData] = await Promise.all([
        fetchReorders(reorderView),
        fetchInventory(session),
      ]);

      const lookup = inventoryData.reduce<Record<string, InventoryItem>>(
        (acc, item) => {
          acc[item.id] = item;
          return acc;
        },
        {},
      );

      setInventoryLookup(lookup);
      setReorders(reorderData);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load reorders");
    } finally {
      setLoading(false);
    }
  }, [session, reorderView]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const processReorder = async (
    reorderId: string,
    status: "COMPLETED" | "CANCELLED",
  ) => {
    try {
      setLoading(true);
      await updateReorderStatus(reorderId, status);
      await loadData();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to process reorder",
      );
      setLoading(false);
    }
  };

  const totals = useMemo(() => {
    const totalQty = reorders.reduce(
      (sum, reorder) => sum + reorder.requestedQty,
      0,
    );
    return { totalOrders: reorders.length, totalQty };
  }, [reorders]);

  const warehouseOptions = useMemo(() => {
    const warehouseMap = new Map<string, string>();

    Object.values(inventoryLookup).forEach((inventory) => {
      warehouseMap.set(inventory.warehouse.name, inventory.warehouse.name);
    });

    return Array.from(warehouseMap.entries()).sort((a, b) =>
      a[1].localeCompare(b[1]),
    );
  }, [inventoryLookup]);

  const filteredReorders = useMemo(
    () =>
      reorders.filter((reorder) => {
        const inventory = inventoryLookup[reorder.inventoryId];
        if (!inventory) return false;

        const warehouseMatches =
          warehouseFilter === "all"
            ? true
            : inventory.warehouse.name === warehouseFilter;
        if (!warehouseMatches) return false;

        if (reorderView === "history" && historyStatusFilter !== "all") {
          return reorder.status === historyStatusFilter;
        }

        return true;
      }),
    [
      reorders,
      inventoryLookup,
      warehouseFilter,
      reorderView,
      historyStatusFilter,
    ],
  );
  useEffect(() => {
    if (!hydrated) return;
    if (authSession?.role === "user") {
      router.replace("/user");
    }
  }, [authSession, hydrated, router]);

  if (!hydrated) {
    return null;
  }

  if (!session) {
    return (
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-4 px-6 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Manager session required</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm">
              Please login from the dashboard page first to process automated
              reorder tasks.
            </p>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-8">
      <section className="grid gap-3 md:grid-cols-2">
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground text-sm">
              {reorderView === "current"
                ? "Open Reorder Tickets"
                : "History Rows"}
            </p>
            <p className="text-2xl font-semibold">{totals.totalOrders}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground text-sm">Requested Units</p>
            <p className="text-2xl font-semibold">{totals.totalQty}</p>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>
            {reorderView === "current"
              ? "Current Reorders Queue"
              : "Reorder History"}
          </CardTitle>

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
              value={reorderView}
              onChange={(event) =>
                setReorderView(event.target.value as "current" | "history")
              }
            >
              <option value="current">Current Reorders</option>
              <option value="history">Reorder History</option>
            </select>

            {reorderView === "history" ? (
              <select
                className="border-input bg-background rounded-md border px-3 py-2 text-sm"
                value={historyStatusFilter}
                onChange={(event) =>
                  setHistoryStatusFilter(
                    event.target.value as "all" | "COMPLETED" | "CANCELLED",
                  )
                }
              >
                <option value="all">All History Statuses</option>
                <option value="COMPLETED">Completed</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            ) : null}
          </div>
        </CardHeader>

        <CardContent>
          {error ? (
            <p className="text-destructive mb-3 text-sm">{error}</p>
          ) : null}

          <div className="scrollbar-hidden max-h-[32rem] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Warehouse</TableHead>
                  <TableHead>Requested Qty</TableHead>
                  <TableHead>Status</TableHead>
                  {reorderView === "current" ? (
                    <TableHead className="text-right">Actions</TableHead>
                  ) : null}
                </TableRow>
              </TableHeader>

              <TableBody>
                {filteredReorders.map((reorder) => {
                  const inventory = inventoryLookup[reorder.inventoryId];

                  return (
                    <TableRow key={reorder.id}>
                      <TableCell>
                        {inventory ? (
                          <>
                            <p className="font-medium">
                              {inventory.product.name}
                            </p>
                            <p className="text-muted-foreground text-xs">
                              {inventory.product.sku}
                            </p>
                          </>
                        ) : (
                          "Unknown item"
                        )}
                      </TableCell>

                      <TableCell>{inventory?.warehouse.name ?? "-"}</TableCell>

                      <TableCell>{reorder.requestedQty}</TableCell>

                      <TableCell>
                        <Badge variant="secondary">{reorder.status}</Badge>
                      </TableCell>

                      {reorderView === "current" ? (
                        <TableCell className="space-x-2 text-right">
                          <Button
                            size="sm"
                            onClick={() =>
                              void processReorder(reorder.id, "COMPLETED")
                            }
                            disabled={loading}
                          >
                            Complete
                          </Button>

                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              void processReorder(reorder.id, "CANCELLED")
                            }
                            disabled={loading}
                          >
                            Cancel
                          </Button>
                        </TableCell>
                      ) : null}
                    </TableRow>
                  );
                })}

                {!filteredReorders.length ? (
                  <TableRow>
                    <TableCell
                      colSpan={reorderView === "current" ? 5 : 4}
                      className="text-muted-foreground text-center"
                    >
                      {loading
                        ? "Loading reorders..."
                        : reorderView === "current"
                          ? "No current reorders"
                          : "No reorder history"}
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}

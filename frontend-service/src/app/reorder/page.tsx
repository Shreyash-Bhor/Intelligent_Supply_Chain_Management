"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  fetchPendingReorders,
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
  const [session, setSession] = useState<ManagerSession | null>(null);
  const [inventoryLookup, setInventoryLookup] = useState<
    Record<string, InventoryItem>
  >({});
  const [reorders, setReorders] = useState<StockReorder[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        fetchPendingReorders(),
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
  }, [session]);

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
              Open Reorder Tickets
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
        <CardHeader>
          <CardTitle>Pending Reorders Queue</CardTitle>
        </CardHeader>
        <CardContent>
          {error ? (
            <p className="text-destructive mb-3 text-sm">{error}</p>
          ) : null}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>Warehouse</TableHead>
                <TableHead>Requested Qty</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reorders.map((reorder) => {
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
                  </TableRow>
                );
              })}
              {!reorders.length ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="text-muted-foreground text-center"
                  >
                    {loading ? "Loading reorders..." : "No pending reorders"}
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </main>
  );
}

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Boxes,
  CheckCircle2,
  ClipboardList,
  Gauge,
} from "lucide-react";
import {
  fetchDashboardSummary,
  fetchInventory,
  verifyManagerAccess,
  type DashboardSummary,
  type InventoryItem,
  type ManagerSession,
} from "@/lib/api";

const getDashboardSnapshot = (
  summaryData: DashboardSummary,
  inventoryData: InventoryItem[],
) => JSON.stringify({ summaryData, inventoryData });

export function useDashboardData(managerSession: ManagerSession | null) {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [inventories, setInventories] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const latestSnapshotRef = useRef<string>("");

  useEffect(() => {
    if (!managerSession) {
      latestSnapshotRef.current = "";
      setSummary(null);
      setInventories([]);
      setError(null);
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

  const warehouseOptions = useMemo(() => {
    const warehouseMap = new Map<string, string>();

    inventories.forEach((inventory) => {
      warehouseMap.set(inventory.warehouse.name, inventory.warehouse.name);
    });

    return Array.from(warehouseMap.entries()).sort((a, b) =>
      a[1].localeCompare(b[1]),
    );
  }, [inventories]);

  return {
    summary,
    inventories,
    loading,
    error,
    stats,
    warehouseOptions,
    setError,
  };
}

"use client";

import { DonutBreakdownChart } from "@/components/dashboard/DonutBreakdownChart";

type Props = {
  data: Array<{ name: string; value: number }>;
  loading?: boolean;
  statusFilter?: string;
};

const healthColors = {
  healthy: "#22c55e",
  low: "#f59e0b",
  critical: "#ef4444",
};

export function InventoryHealthPieChart({
  data,
  loading = false,
  statusFilter = "all",
}: Props) {
  const visibleData = data.filter(
    (item) =>
      statusFilter === "all" || item.name.toLowerCase() === statusFilter,
  );

  return (
    <DonutBreakdownChart
      data={visibleData}
      loading={loading}
      colorByName={healthColors}
    />
  );
}

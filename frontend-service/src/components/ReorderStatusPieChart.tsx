"use client";

import { DonutBreakdownChart } from "@/components/dashboard/DonutBreakdownChart";

type Props = {
  data: Array<{ name: string; value: number }>;
  loading?: boolean;
  statusFilter?: string;
};

const reorderColors = {
  pending: "#f59e0b",
  completed: "#10b981",
  cancelled: "#64748b",
  failed: "#ef4444",
};

export function ReorderStatusPieChart({
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
      colorByName={reorderColors}
    />
  );
}

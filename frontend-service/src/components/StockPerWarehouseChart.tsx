"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Props = {
  data: {
    warehouseName?: string | null;
    totalUnits: number;
  }[];
  loading?: boolean;
  warehouseFilter?: string;
};

const MAX_VISIBLE_ROWS = 50;

export function StockPerWarehouseChart({
  data,
  loading = false,
  warehouseFilter = "all",
}: Props) {
  const visibleData = data
    .filter(
      (item) =>
        warehouseFilter === "all" || item.warehouseName === warehouseFilter,
    )
    .slice(0, MAX_VISIBLE_ROWS);
  if (loading) {
    return <div className="bg-muted h-full w-full animate-pulse rounded-md" />;
  }

  if (!visibleData.length) {
    return (
      <div className="text-muted-foreground flex h-full items-center justify-center text-sm">
        No data available
      </div>
    );
  }

  return (
    <div className="h-full w-full">
      <ResponsiveContainer>
        <BarChart data={visibleData}>
          <CartesianGrid
            strokeDasharray="3 3"
            vertical={false}
            className="stroke-border"
          />
          <XAxis
            dataKey="warehouseName"
            tickLine={false}
            axisLine={false}
            tick={{ fill: "currentColor", fontSize: 12 }}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={{ fill: "currentColor", fontSize: 12 }}
          />
          <Tooltip
            cursor={false}
            contentStyle={{
              borderRadius: 12,
              border: "1px solid var(--border)",
              backgroundColor: "var(--popover)",
              color: "var(--popover-foreground)",
            }}
          />

          <Bar
            dataKey="totalUnits"
            activeBar={false}
            fill="var(--primary)"
            radius={[6, 6, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

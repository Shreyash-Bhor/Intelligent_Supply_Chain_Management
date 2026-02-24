"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Props = {
  data: Array<{
    warehouseName?: string | null;
    availableUnits: number;
    reservedUnits: number;
  }>;
  loading?: boolean;
};

export function WarehouseUtilizationChart({ data, loading = false }: Props) {
  if (loading) {
    return <div className="bg-muted h-80 w-full animate-pulse rounded-md" />;
  }

  if (!data.length) {
    return (
      <div className="text-muted-foreground flex h-80 items-center justify-center text-sm">
        No data available
      </div>
    );
  }

  return (
    <div className="h-80 w-full">
      <ResponsiveContainer>
        <BarChart data={data}>
          <CartesianGrid
            strokeDasharray="3 3"
            vertical={false}
            className="stroke-border"
          />
          <XAxis dataKey="warehouseName" tickLine={false} axisLine={false} />
          <YAxis tickLine={false} axisLine={false} />
          <Tooltip
            contentStyle={{
              borderRadius: 12,
              border: "1px solid var(--border)",
              backgroundColor: "var(--card)",
            }}
          />
          <Legend />
          <Bar
            dataKey="availableUnits"
            stackId="inventory"
            fill="#3b82f6"
            radius={[6, 6, 0, 0]}
          />
          <Bar
            dataKey="reservedUnits"
            stackId="inventory"
            fill="#f97316"
            radius={[6, 6, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

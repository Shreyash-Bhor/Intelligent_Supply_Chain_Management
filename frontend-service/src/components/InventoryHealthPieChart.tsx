"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

type Props = {
  data: Array<{ name: string; value: number }>;
  loading?: boolean;
  statusFilter?: string;
};

const COLORS = ["#22c55e", "#f59e0b", "#ef4444"];

export function InventoryHealthPieChart({
  data,
  loading = false,
  statusFilter = "all",
}: Props) {
  const visibleData = data
    .filter(
      (item) =>
        statusFilter === "all" || item.name.toLowerCase() === statusFilter,
    )
    .slice(0, 50);
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
        <PieChart>
          <Pie
            data={visibleData}
            activeShape={false}
            innerRadius={70}
            outerRadius={110}
            paddingAngle={2}
            dataKey="value"
            nameKey="name"
          >
            {visibleData.map((entry, index) => (
              <Cell
                key={`${entry.name}-${index}`}
                fill={COLORS[index % COLORS.length]}
              />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              borderRadius: 12,
              border: "1px solid var(--border)",
              backgroundColor: "var(--popover)",
              color: "var(--popover-foreground)",
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

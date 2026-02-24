"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

type Props = {
  data: Array<{ name: string; value: number }>;
  loading?: boolean;
};

const COLORS = ["#22c55e", "#f59e0b", "#ef4444"];

export function InventoryHealthPieChart({ data, loading = false }: Props) {
  if (loading) {
    return <div className="bg-muted h-72 w-full animate-pulse rounded-md" />;
  }

  if (!data.length) {
    return (
      <div className="text-muted-foreground flex h-72 items-center justify-center text-sm">
        No data available
      </div>
    );
  }

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer>
        <PieChart>
          <Pie
            data={data}
            innerRadius={70}
            outerRadius={110}
            paddingAngle={2}
            dataKey="value"
            nameKey="name"
          >
            {data.map((entry, index) => (
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
              backgroundColor: "var(--card)",
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

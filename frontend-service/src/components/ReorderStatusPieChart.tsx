"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

type Props = {
  data: Array<{ name: string; value: number }>;
  loading?: boolean;
};

const COLORS = ["#f59e0b", "#10b981", "#6b7280"];

export function ReorderStatusPieChart({ data, loading = false }: Props) {
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
            innerRadius={55}
            outerRadius={110}
            dataKey="value"
            nameKey="name"
            label
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

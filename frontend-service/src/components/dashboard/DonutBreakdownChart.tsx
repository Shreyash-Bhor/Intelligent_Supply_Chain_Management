"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { cn } from "@/lib/utils";

type BreakdownItem = { name: string; value: number };

type Props = {
  data: BreakdownItem[];
  loading?: boolean;
  colorByName: Record<string, string>;
  emptyMessage?: string;
};

const fallbackColors = ["#6366f1", "#14b8a6", "#f59e0b", "#ef4444"];

function getColor(item: BreakdownItem, index: number, colorByName: Record<string, string>) {
  return colorByName[item.name.toLowerCase()] ?? fallbackColors[index % fallbackColors.length];
}

export function DonutBreakdownChart({
  data,
  loading = false,
  colorByName,
  emptyMessage = "No data available",
}: Props) {
  const total = data.reduce((sum, item) => sum + item.value, 0);

  if (loading) {
    return <div className="bg-muted h-full w-full animate-pulse rounded-md" />;
  }

  if (!data.length) {
    return (
      <div className="text-muted-foreground flex h-full items-center justify-center text-sm">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1">
        <ResponsiveContainer>
          <PieChart>
            <Pie
              data={data}
              activeShape={false}
              innerRadius={62}
              outerRadius={94}
              paddingAngle={3}
              dataKey="value"
              nameKey="name"
              stroke="none"
            >
              {data.map((item, index) => (
                <Cell
                  key={`${item.name}-${index}`}
                  fill={getColor(item, index, colorByName)}
                />
              ))}
            </Pie>
            <text
              x="50%"
              y="47%"
              textAnchor="middle"
              dominantBaseline="middle"
              className="fill-foreground text-2xl font-semibold"
            >
              {total.toLocaleString()}
            </text>
            <text
              x="50%"
              y="58%"
              textAnchor="middle"
              dominantBaseline="middle"
              className="fill-muted-foreground text-[11px]"
            >
              total
            </text>
            <Tooltip
              formatter={(value) => [Number(value).toLocaleString(), "Items"]}
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
      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 pt-2">
        {data.map((item, index) => (
          <div key={item.name} className="flex min-w-0 items-center gap-1.5 text-xs">
            <span
              className="size-2 shrink-0 rounded-full"
              style={{ backgroundColor: getColor(item, index, colorByName) }}
              aria-hidden="true"
            />
            <span className="text-muted-foreground truncate capitalize">{item.name}</span>
            <span className={cn("ml-auto font-medium tabular-nums", item.value === 0 && "text-muted-foreground")}>
              {item.value.toLocaleString()}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

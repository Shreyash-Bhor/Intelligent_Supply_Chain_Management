"use client";

import type { LucideIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type StatItem = {
  title: string;
  value: string | number;
  description: string;
  icon: LucideIcon;
  danger?: boolean;
};

type Props = {
  stats: StatItem[];
  loading: boolean;
};

export function StatsGrid({ stats, loading }: Props) {
  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
      {stats.map((item) => (
        <Card
          key={item.title}
          className={item.danger ? "border-destructive/40" : ""}
        >
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-sm font-medium">{item.title}</CardTitle>
            <item.icon
              className={`h-4 w-4 ${item.danger ? "text-destructive" : "text-muted-foreground"}`}
            />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">
              {loading
                ? "..."
                : typeof item.value === "number"
                  ? item.value.toLocaleString()
                  : item.value}
            </p>
            <p className="text-muted-foreground mt-1 text-xs">
              {item.description}
            </p>
          </CardContent>
        </Card>
      ))}
    </section>
  );
}

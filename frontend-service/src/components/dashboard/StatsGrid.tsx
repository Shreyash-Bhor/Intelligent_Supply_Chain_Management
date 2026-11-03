"use client";

import type { LucideIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
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
          style={{ animationDelay: `${Math.min(stats.indexOf(item), 6) * 55}ms` }}
          className={`dashboard-card-enter transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${item.danger ? "border-destructive/40 bg-destructive/[0.02]" : ""}`}
        >
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-sm font-medium">{item.title}</CardTitle>
            <item.icon
              className={`h-4 w-4 ${item.danger ? "text-destructive" : "text-muted-foreground"}`}
            />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold tabular-nums">
              {loading
                ? "..."
                : typeof item.value === "number"
                  ? <CountUp value={item.value} />
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

function CountUp({ value }: { value: number }) {
  const [display, setDisplay] = useState(0);
  const current = useRef(0);
  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) { current.current = value; setDisplay(value); return; }
    let frame = 0;
    const started = performance.now();
    const initial = current.current;
    const animate = (now: number) => {
      const progress = Math.min((now - started) / 450, 1);
      const eased = 1 - (1 - progress) ** 3;
      const next = Math.round(initial + (value - initial) * eased);
      current.current = next;
      setDisplay(next);
      if (progress < 1) frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [value]);
  return <>{display.toLocaleString()}</>;
}

"use client";

import Link from "next/link";
import { ArrowUpRight, CircleCheck, PackageSearch, ShieldAlert } from "lucide-react";
import type { DashboardSummary } from "@/lib/api";

type Props = {
  summary: DashboardSummary | null;
  loading?: boolean;
};

export function OperationsPulse({ summary, loading = false }: Props) {
  const cards = [
    {
      label: "Stock attention",
      value: summary?.lowStockCount ?? 0,
      detail: "SKUs at or below reorder level",
      href: "/inventory",
      icon: ShieldAlert,
      tone: "text-rose-600 bg-rose-500/10 dark:text-rose-300",
    },
    {
      label: "Replenishment queue",
      value: summary?.openOrders ?? 0,
      detail: "Open orders awaiting action",
      href: "/reorder",
      icon: PackageSearch,
      tone: "text-amber-600 bg-amber-500/10 dark:text-amber-300",
    },
    {
      label: "Fulfillment health",
      value: `${summary?.fillRate ?? 0}%`,
      detail: `${summary?.totalUnits?.toLocaleString() ?? 0} available units`,
      href: "/inventory",
      icon: CircleCheck,
      tone: "text-emerald-600 bg-emerald-500/10 dark:text-emerald-300",
    },
  ];

  return (
    <section aria-label="Operations pulse" className="grid gap-3 md:grid-cols-3">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <Link
            key={card.label}
            href={card.href}
            className="group bg-card hover:border-primary/35 flex items-center gap-3 rounded-2xl border p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
          >
            <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${card.tone}`}>
              <Icon className="size-5" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-muted-foreground text-xs font-medium">{card.label}</p>
              <p className="mt-0.5 text-xl font-semibold tabular-nums">
                {loading ? "—" : typeof card.value === "number" ? card.value.toLocaleString() : card.value}
              </p>
              <p className="text-muted-foreground truncate text-xs">{card.detail}</p>
            </div>
            <ArrowUpRight className="text-muted-foreground size-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden="true" />
          </Link>
        );
      })}
    </section>
  );
}

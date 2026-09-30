"use client";

import { RefreshCw, RotateCcw, Signal, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  loading: boolean;
  lastUpdated: Date | null;
  hasActiveFilters: boolean;
  onRefresh: () => void;
  onResetFilters: () => void;
};

function formatLastUpdated(value: Date | null) {
  if (!value) return "Awaiting first sync";

  return `Updated ${new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  }).format(value)}`;
}

export function DashboardHeader({
  loading,
  lastUpdated,
  hasActiveFilters,
  onRefresh,
  onResetFilters,
}: Props) {
  return (
    <section className="dashboard-hero relative overflow-hidden rounded-3xl border px-5 py-6 sm:px-7 sm:py-8">
      <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          <div className="text-primary mb-3 flex items-center gap-2 text-xs font-semibold tracking-[0.16em] uppercase">
            <span className="bg-primary/12 rounded-full p-1.5">
              <Sparkles className="size-3.5" aria-hidden="true" />
            </span>
            Supply chain control tower
          </div>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Inventory, made easier to act on.
          </h1>
          <p className="text-muted-foreground mt-3 max-w-xl text-sm leading-6">
            Prioritize stock risk, monitor fulfillment, and keep every warehouse
            aligned from one clear operational view.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div
            className="bg-background/70 text-muted-foreground flex items-center gap-2 rounded-xl border px-3 py-2 text-xs shadow-sm"
            aria-live="polite"
          >
            <Signal
              className={`size-3.5 ${loading ? "animate-pulse text-amber-500" : "text-emerald-500"}`}
              aria-hidden="true"
            />
            {loading ? "Syncing data" : formatLastUpdated(lastUpdated)}
          </div>
          {hasActiveFilters ? (
            <Button variant="outline" size="sm" onClick={onResetFilters}>
              <RotateCcw className="mr-2 size-3.5" aria-hidden="true" />
              Clear filters
            </Button>
          ) : null}
          <Button size="sm" onClick={onRefresh} disabled={loading}>
            <RefreshCw
              className={`mr-2 size-3.5 ${loading ? "animate-spin" : ""}`}
              aria-hidden="true"
            />
            Refresh
          </Button>
        </div>
      </div>
    </section>
  );
}

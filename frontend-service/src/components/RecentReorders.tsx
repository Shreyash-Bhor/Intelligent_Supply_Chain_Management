"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Reorder = {
  id: string;
  requestedQty: number;
  status: string;
  productName: string;
  sku: string;
  warehouseName: string;
  createdAt: string;
};

type Props = {
  data: Reorder[];
  loading?: boolean;
};

const statusStyles: Record<string, string> = {
  PENDING: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  COMPLETED: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  FAILED: "bg-red-500/15 text-red-700 dark:text-red-300",
  CANCELLED: "bg-slate-500/15 text-slate-700 dark:text-slate-300",
};

export function RecentReorders({ data, loading = false }: Props) {
  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={`reorder-skeleton-${index}`}
            className="bg-muted h-20 animate-pulse rounded-lg"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {data.length === 0 ? (
        <p className="text-muted-foreground py-8 text-sm">No data available</p>
      ) : (
        data.map((item) => (
          <div
            key={item.id}
            className="bg-muted/30 flex flex-wrap items-center justify-between gap-4 rounded-lg border p-4"
          >
            <div>
              <p className="font-medium">
                {item.productName}{" "}
                <span className="text-muted-foreground">({item.sku})</span>
              </p>
              <p className="text-muted-foreground text-sm">
                {item.warehouseName}
              </p>
            </div>

            <div className="ml-auto flex items-center gap-3">
              <div className="text-right text-sm">
                <p className="font-semibold">{item.requestedQty} units</p>
                <p className="text-muted-foreground">
                  {new Date(item.createdAt).toLocaleDateString()}
                </p>
              </div>
              <Badge
                className={cn("capitalize", statusStyles[item.status] ?? "")}
              >
                {item.status.toLowerCase()}
              </Badge>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

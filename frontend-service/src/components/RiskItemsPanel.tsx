"use client";

import { Badge } from "@/components/ui/badge";

type RiskItem = {
  id: string;
  productName: string;
  sku: string;
  warehouseName: string;
  availableQty: number;
  reorderQty: number;
  deficit: number;
};
const MAX_VISIBLE_ROWS = 50;
export function RiskItemsPanel({
  items,
  loading = false,
  warehouseFilter = "all",
}: {
  items: RiskItem[];
  loading?: boolean;
  warehouseFilter?: string;
}) {
  const latestRisks = [...items]
    .filter(
      (item) =>
        warehouseFilter === "all" || item.warehouseName === warehouseFilter,
    )
    .sort((a, b) => b.deficit - a.deficit)
    .slice(0, MAX_VISIBLE_ROWS);

  if (loading) {
    return (
      <div className="h-full space-y-3 overflow-hidden">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={`risk-skeleton-${index}`}
            className="bg-muted h-16 animate-pulse rounded-lg"
          />
        ))}
      </div>
    );
  }

  if (latestRisks.length === 0) {
    return <p className="text-muted-foreground text-sm">No data available</p>;
  }

  return (
    <div className="scrollbar-hidden h-full space-y-2 overflow-y-auto pr-1">
      {latestRisks.map((item) => (
        <div
          key={item.id}
          className="flex items-center justify-between rounded-lg border px-3 py-2"
        >
          <div>
            <p className="text-sm font-medium">
              {item.productName}{" "}
              <span className="text-muted-foreground">({item.sku})</span>
            </p>
            <p className="text-muted-foreground text-[11px]">
              {item.warehouseName}
            </p>
          </div>
          <div className="text-right text-xs">
            <Badge variant="destructive">Deficit {item.deficit}</Badge>
            <p className="text-muted-foreground mt-1 text-xs">
              {item.availableQty} / {item.reorderQty} target
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

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

export function RiskItemsPanel({
  items,
  loading = false,
}: {
  items: RiskItem[];
  loading?: boolean;
}) {
  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={`risk-skeleton-${index}`}
            className="bg-muted h-16 animate-pulse rounded-lg"
          />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return <p className="text-muted-foreground text-sm">No data available</p>;
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div
          key={item.id}
          className="flex items-center justify-between rounded-lg border p-3"
        >
          <div>
            <p className="font-medium">
              {item.productName}{" "}
              <span className="text-muted-foreground">({item.sku})</span>
            </p>
            <p className="text-muted-foreground text-xs">
              {item.warehouseName}
            </p>
          </div>
          <div className="text-right">
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

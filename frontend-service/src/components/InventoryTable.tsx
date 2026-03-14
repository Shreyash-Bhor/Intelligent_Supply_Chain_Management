"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { InventoryItem } from "@/lib/api";

type Props = {
  inventories: InventoryItem[];
  loading?: boolean;
};

export function InventoryTable({ inventories, loading = false }: Props) {
  return (
    <Table className="w-full">
      <TableHeader>
        <TableRow>
          <TableHead>Product</TableHead>
          <TableHead>SKU</TableHead>
          <TableHead>Warehouse</TableHead>
          <TableHead className="text-right">Available</TableHead>
          <TableHead className="text-right">Reserved</TableHead>
          <TableHead className="text-right">Reorder Level</TableHead>
          <TableHead className="text-right">Status</TableHead>
        </TableRow>
      </TableHeader>

      <TableBody>
        {loading ? (
          Array.from({ length: 6 }).map((_, index) => (
            <TableRow key={`skeleton-${index}`}>
              <TableCell colSpan={7}>
                <div className="bg-muted h-8 w-full animate-pulse rounded" />
              </TableCell>
            </TableRow>
          ))
        ) : inventories.length === 0 ? (
          <TableRow>
            <TableCell
              colSpan={7}
              className="text-muted-foreground py-10 text-center"
            >
              No data available
            </TableCell>
          </TableRow>
        ) : (
          inventories.map((inventory) => {
            const isLowStock = inventory.availableQty <= inventory.reorderQty;

            return (
              <TableRow
                key={inventory.id}
                className={isLowStock ? "bg-destructive/5" : ""}
              >
                <TableCell className="font-medium">
                  {inventory.product.name}
                </TableCell>
                <TableCell>{inventory.product.sku}</TableCell>
                <TableCell>{inventory.warehouse.name}</TableCell>
                <TableCell className="text-right">
                  {inventory.availableQty}
                </TableCell>
                <TableCell className="text-right">
                  {inventory.reservedQty}
                </TableCell>
                <TableCell className="text-right">
                  {inventory.reorderQty}
                </TableCell>
                <TableCell className="text-right">
                  {isLowStock ? (
                    <Badge className="border-0 bg-rose-500 text-white dark:bg-rose-400 dark:text-rose-950">
                      Low
                    </Badge>
                  ) : (
                    <Badge className="border-0 bg-emerald-500 text-white dark:bg-emerald-400 dark:text-emerald-950">
                      Healthy
                    </Badge>
                  )}
                </TableCell>
              </TableRow>
            );
          })
        )}
      </TableBody>
    </Table>
  );
}

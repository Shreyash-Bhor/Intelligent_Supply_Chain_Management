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
};

export function InventoryTable({ inventories }: Props) {
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
        {inventories.length === 0 ? (
          <TableRow>
            <TableCell
              colSpan={7}
              className="text-muted-foreground py-10 text-center"
            >
              No inventory records available.
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
                  {inventory.isReorderPending ? (
                    <Badge variant="secondary">Reorder Pending</Badge>
                  ) : isLowStock ? (
                    <Badge variant="destructive">Low Stock</Badge>
                  ) : (
                    <Badge variant="outline">Healthy</Badge>
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

"use client";

import { useEffect, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Inventory = {
  id: string;
  availableQty: number;
  reservedQty: number;
  reorderQty: number;
  isReorderPending: boolean;
  product: {
    name: string;
    sku: string;
  };
  warehouse: {
    name: string;
  };
};

export function InventoryTable() {
  const [inventories, setInventories] = useState<Inventory[]>([]);

  useEffect(() => {
    const fetchInventories = async () => {
      const res = await fetch("http://localhost:5000/inventory/");
      const data = await res.json();
      setInventories(data.data);
    };

    fetchInventories();
  }, []);

  return (
    <Table className="w-full">
      <TableHeader>
        <TableRow>
          <TableHead className="text-center">Product</TableHead>
          <TableHead className="text-center">SKU</TableHead>
          <TableHead className="text-center">Warehouse</TableHead>
          <TableHead className="text-center">Available</TableHead>
          <TableHead className="text-center">Reserved</TableHead>
          <TableHead className="text-center">Reorder Level</TableHead>
          <TableHead className="text-center">Reorder Status</TableHead>
        </TableRow>
      </TableHeader>

      <TableBody>
        {inventories.map((inv) => (
          <TableRow
            key={inv.id}
            className={`${
              inv.availableQty <= inv.reorderQty
                ? "bg-red-50 border-l-4 border-red-500"
                : ""
            }`}
          >
            <TableCell className="text-center">{inv.product.name}</TableCell>
            <TableCell className="text-center">{inv.product.sku}</TableCell>
            <TableCell className="text-center">{inv.warehouse.name}</TableCell>
            <TableCell className="text-center">
              {inv.availableQty <= inv.reorderQty ? (
                <span className="text-red-600 font-semibold">
                  {inv.availableQty} ⚠
                </span>
              ) : (
                inv.availableQty
              )}
            </TableCell>
            <TableCell className="text-center">{inv.reservedQty}</TableCell>
            <TableCell className="text-center">{inv.reorderQty}</TableCell>
            <TableCell className="text-center">
              {inv.isReorderPending ? "Pending" : "No"}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

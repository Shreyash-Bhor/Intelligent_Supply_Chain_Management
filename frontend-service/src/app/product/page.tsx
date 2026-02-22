"use client";

import { useEffect, useState } from "react";
import { InventoryTable } from "@/components/InventoryTable";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchInventory, type InventoryItem } from "@/lib/api";

export default function ProductPage() {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);

  useEffect(() => {
    fetchInventory()
      .then(setInventory)
      .catch(() => setInventory([]));
  }, []);

  return (
    <main className="mx-auto w-full max-w-7xl px-6 py-8">
      <Card>
        <CardHeader>
          <CardTitle>Inventory Catalog</CardTitle>
        </CardHeader>
        <CardContent>
          <InventoryTable inventories={inventory} />
        </CardContent>
      </Card>
    </main>
  );
}

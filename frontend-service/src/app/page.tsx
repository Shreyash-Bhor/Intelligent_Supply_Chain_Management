"use client";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { InventoryTable } from "@/components/InventoryTable";
import { StockPerWarehouseChart } from "@/components/StockPerWarehouseChart";
import { RecentReorders } from "@/components/RecentReorders";

export default function Home() {
  const [summary, setSummary] = useState({
    totalProducts: 0,
    openOrders: 0,
    lowStockCount: 0,
    totalUnits: 0,
    stockPerWarehouse: [],
    recentReorders: [],
  });

  useEffect(() => {
    const fetchSummary = async () => {
      try {
        const res = await fetch("http://localhost:5000/dashboard/summary");
        const result = await res.json();

        if (result.status === "success") {
          setSummary(result.data);
        }
      } catch (error) {
        console.error("Error fetching summary", error);
      }
    };

    fetchSummary();
  }, []);

  return (
    <div className="min-h-screen">
      <main className="max-w-7xl mx-auto px-6 py-6">
        <div className="grid grid-cols-4 gap-6 mb-4">
          <Card className="h-40 flex items-center justify-center text-xl font-semibold">
            {summary.totalProducts} SKU
          </Card>

          <Card className="h-40 flex items-center justify-center text-xl font-semibold">
            {summary.totalUnits} Units
          </Card>

          <Card className="h-40 flex items-center justify-center text-xl font-semibold">
            {summary.openOrders} Open Orders
          </Card>

          <Card
            className={`h-40 flex items-center justify-center text-xl font-semibold ${
              summary.lowStockCount > 0 ? "border-red-500 text-red-600" : ""
            }`}
          >
            {summary.lowStockCount} Low Stock
          </Card>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Card>
            <InventoryTable />
          </Card>
          <Card>
            <StockPerWarehouseChart data={summary.stockPerWarehouse} />
          </Card>
        </div>
        <div>
          <Card className="my-4 px-2">
            <RecentReorders data={summary.recentReorders} />
          </Card>
        </div>
      </main>
    </div>
  );
}

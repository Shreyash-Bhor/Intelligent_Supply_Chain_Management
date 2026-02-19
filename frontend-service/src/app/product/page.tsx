"use client";
import {
  Card,
  CardAction,
  CardDescription,
  CardContent,
  CardTitle,
} from "@/components/ui/card";
import { InventoryTable } from "@/components/InventoryTable";
export default function Home() {
  return (
    <>
      <div className="grid gap-2 grid-cols-4">
        <div className="flex">
          <Card>
            <InventoryTable />
          </Card>
        </div>
        {/* <div>
          <Card></Card>
        </div>
        <div>
          <Card></Card>
        </div>
        <div>
          <Card></Card>
        </div>
        <div>
          <Card></Card>
        </div> */}
      </div>
    </>
  );
}

"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

type Props = {
  data: {
    warehouseName: string;
    totalUnits: number;
  }[];
};

export function StockPerWarehouseChart({ data }: Props) {
  return (
    <div className="w-full h-80">
      <ResponsiveContainer>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="warehouseName" />
          <YAxis />
          <Tooltip />
          <Bar dataKey="totalUnits" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

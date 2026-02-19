"use client";

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
};

export function RecentReorders({ data }: Props) {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Recent Reorders</h2>

      {data.map((r) => (
        <div
          key={r.id}
          className="flex justify-between items-center p-4 border rounded-lg"
        >
          <div>
            <p className="font-medium">
              {r.productName} ({r.sku})
            </p>
            <p className="text-sm text-gray-500">{r.warehouseName}</p>
          </div>

          <div className="text-right">
            <p className="font-semibold">{r.requestedQty} units</p>
            <p
              className={`text-sm font-medium ${
                r.status === "PENDING"
                  ? "text-yellow-600"
                  : r.status === "COMPLETED"
                    ? "text-green-600"
                    : "text-red-600"
              }`}
            >
              {r.status}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

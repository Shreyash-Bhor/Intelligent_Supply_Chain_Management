export type ApiResponse<T> = {
  status: "success" | "error";
  message: string;
  data: T;
};

export type DashboardSummary = {
  totalProducts: number;
  openOrders: number;
  lowStockCount: number;
  totalUnits: number;
  stockPerWarehouse: Array<{
    warehouseName?: string | null;
    totalUnits: number;
  }>;
  recentReorders: Array<{
    id: string;
    requestedQty: number;
    status: string;
    productName: string;
    sku: string;
    warehouseName: string;
    createdAt: string;
  }>;
};

export type InventoryItem = {
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

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ??
  "http://localhost:5000";

async function fetchApi<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Request failed (${response.status}) for ${path}`);
  }

  const payload = (await response.json()) as ApiResponse<T>;

  if (payload.status !== "success") {
    throw new Error(payload.message || "Unexpected API response");
  }

  return payload.data;
}

export function fetchDashboardSummary() {
  return fetchApi<DashboardSummary>("/dashboard/summary");
}

export function fetchInventory() {
  return fetchApi<InventoryItem[]>("/api/inventory");
}

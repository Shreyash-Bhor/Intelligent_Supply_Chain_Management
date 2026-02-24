export type ApiResponse<T> = {
  status: "success" | "error";
  message: string;
  data: T;
};

export type ManagerSession = {
  email: string;
  accessKey: string;
};

export type DashboardSummary = {
  totalProducts: number;
  openOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  lowStockCount: number;
  criticalStockCount: number;
  totalUnits: number;
  totalReservedUnits: number;
  fillRate: number;
  stockPerWarehouse: Array<{
    warehouseName?: string | null;
    totalUnits: number;
    reservedUnits: number;
  }>;
  warehouseUtilization: Array<{
    warehouseName?: string | null;
    availableUnits: number;
    reservedUnits: number;
    utilization: number;
  }>;
  inventoryHealthBreakdown: Array<{
    name: string;
    value: number;
  }>;
  reorderStatusBreakdown: Array<{
    name: string;
    value: number;
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
  topRiskItems: Array<{
    id: string;
    productName: string;
    sku: string;
    warehouseName: string;
    availableQty: number;
    reorderQty: number;
    deficit: number;
  }>;
  meta: {
    generatedAt: string;
    totalOrders: number;
  };
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

async function fetchApi<T>(
  path: string,
  managerSession: ManagerSession,
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      "x-manager-email": managerSession.email,
      "x-manager-access-key": managerSession.accessKey,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("No data available");
  }

  const payload = (await response.json()) as ApiResponse<T>;

  if (payload.status !== "success") {
    throw new Error(payload.message || "Unexpected API response");
  }

  return payload.data;
}

export function verifyManagerAccess(managerSession: ManagerSession) {
  return fetchApi<{ email: string; authenticatedAt: string }>(
    "/dashboard/access",
    managerSession,
  );
}

export function fetchDashboardSummary(managerSession: ManagerSession) {
  return fetchApi<DashboardSummary>("/dashboard/summary", managerSession);
}

export function fetchInventory(managerSession: ManagerSession) {
  return fetchApi<InventoryItem[]>("/api/inventory", managerSession);
}

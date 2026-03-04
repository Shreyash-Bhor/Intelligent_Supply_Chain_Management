export type ApiResponse<T> = {
  status: "success" | "error" | "conflict";
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
    totalUnits: number;
    reservedUnits: number;
    utilizationRate: number;
  }>;
  lowStockItems: Array<{
    productName: string;
    sku: string;
    warehouseName?: string | null;
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

export type Product = {
  id: string;
  name: string;
  sku: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type StatusFilter = "active" | "inactive" | "all";

export type Warehouse = {
  id: string;
  name: string;
  city: string;
  pincode: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ??
  "http://localhost:5000";

type RequestOptions = {
  managerSession?: ManagerSession;
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
};

async function fetchApi<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      ...(options.managerSession
        ? {
            "x-manager-email": options.managerSession.email,
            "x-manager-access-key": options.managerSession.accessKey,
          }
        : {}),
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    cache: "no-store",
  });

  const payload = (await response.json()) as ApiResponse<T>;

  if (!response.ok || payload.status !== "success") {
    throw new Error(payload?.message || "Unexpected API response");
  }

  return payload.data;
}

export function verifyManagerAccess(managerSession: ManagerSession) {
  return fetchApi<{ email: string; authenticatedAt: string }>(
    "/dashboard/access",
    { managerSession },
  );
}

export function fetchDashboardSummary(managerSession: ManagerSession) {
  return fetchApi<DashboardSummary>("/dashboard/summary", { managerSession });
}

export function fetchInventory(managerSession: ManagerSession) {
  return fetchApi<InventoryItem[]>("/api/inventory", { managerSession });
}

export function fetchProducts(status: StatusFilter = "active") {
  return fetchApi<Product[]>(`/api/product/products?status=${status}`);
}

export function createProduct(body: { name: string; sku: string }) {
  return fetchApi<Product>("/api/product", { method: "POST", body });
}

export function updateProduct(
  productId: string,
  body: { name?: string; sku?: string },
) {
  return fetchApi<Product>(`/api/product/${productId}`, {
    method: "PATCH",
    body,
  });
}

export function updateProductStatus(productId: string, isActive: boolean) {
  return fetchApi<Product>(`/api/product/${productId}/status`, {
    method: "PATCH",
    body: { isActive },
  });
}

export function deleteProduct(
  productId: string,
  reason: "OUT_OF_STOCK" | "DEPRECATED" | "NO_LONGER_NEEDED",
) {
  return fetchApi<Product>(`/api/product/${productId}`, {
    method: "DELETE",
    body: { reason },
  });
}

export function fetchWarehouses(status: StatusFilter = "active") {
  return fetchApi<Warehouse[]>(`/warehouse/warehouses?status=${status}`);
}

export function createWarehouse(body: {
  name: string;
  city: string;
  pincode: string;
}) {
  return fetchApi<Warehouse>("/warehouse", { method: "POST", body });
}

export function updateWarehouse(
  warehouseId: string,
  body: { name?: string; city?: string; pincode?: string },
) {
  return fetchApi<Warehouse>(`/warehouse/${warehouseId}`, {
    method: "PATCH",
    body,
  });
}

export function updateWarehouseStatus(warehouseId: string, isActive: boolean) {
  return fetchApi<Warehouse>(`/warehouse/${warehouseId}/status`, {
    method: "PATCH",
    body: { isActive },
  });
}

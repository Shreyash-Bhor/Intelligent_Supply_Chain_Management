// frontend-service/src/lib/api.ts

export type ApiResponse<T> = {
  status: string;
  message?: string;
  data: T;
};

export type ManagerSession = {
  email: string;
  accessKey: string;
};

export type UserAccount = {
  id: string;
  email: string;
  isEmailVerified: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
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
  }>;
  inventoryHealthBreakdown: Array<{
    name: string;
    value: number;
  }>;
  reorderStatusBreakdown: Array<{
    name: string;
    value: number;
  }>;
  lowStockItems: Array<{
    productName: string;
    sku: string;
    warehouseName?: string | null;
    availableQty: number;
    reorderQty: number;
    deficit: number;
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
  recentReorders: Array<{
    id: string;
    requestedQty: number;
    status: string;
    productName: string;
    sku: string;
    warehouseName: string;
    createdAt: string;
  }>;
  meta: {
    generatedAt: string;
    totalOrders: number;
  };
};

export type InventoryItem = {
  id: string;
  productId: string;
  warehouseId: string;
  availableQty: number;
  reservedQty: number;
  reorderQty: number;
  isReorderPending: boolean;
  createdAt: string;
  updatedAt: string;
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

export type ReorderStatus = "PENDING" | "COMPLETED" | "CANCELLED";

export type StockReorder = {
  id: string;
  inventoryId: string;
  requestedQty: number;
  status: ReorderStatus;
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
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const payload = (await response.json()) as ApiResponse<T>;

  if (!response.ok || payload.status !== "success") {
    throw new Error(payload?.message || "Unexpected API response");
  }

  return payload.data;
}

async function fetchRawApi<T>(
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
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const payload = (await response.json()) as T & {
    status?: string;
    message?: string;
  };

  if (!response.ok || payload.status !== "success") {
    throw new Error(payload?.message || "Unexpected API response");
  }

  return payload;
}

export function verifyManagerAccess(managerSession: ManagerSession) {
  return fetchApi<{ email: string; authenticatedAt: string }>(
    "/dashboard/access",
    { managerSession },
  );
}

export function registerUser(body: { email: string; password: string }) {
  return fetchRawApi<{ status: string; message: string; newUser: UserAccount }>(
    "/api/signup",
    {
      method: "POST",
      body,
    },
  );
}

export function loginUser(body: { email: string; password: string }) {
  return fetchRawApi<{ status: string; message: string; user: UserAccount }>(
    "/api/login",
    {
      method: "POST",
      body,
    },
  );
}

export function fetchDashboardSummary(managerSession: ManagerSession) {
  return fetchApi<DashboardSummary>("/dashboard/summary", { managerSession });
}

export function fetchInventory(managerSession: ManagerSession) {
  return fetchApi<InventoryItem[]>("/api/inventory", { managerSession });
}

export function createInventory(
  managerSession: ManagerSession,
  body: {
    productId: string;
    warehouseId: string;
    availableQty: number;
    reservedQty: number;
    reorderQty: number;
  },
) {
  return fetchApi<InventoryItem>("/api/inventory", {
    managerSession,
    method: "POST",
    body,
  });
}

export function updateInventory(
  managerSession: ManagerSession,
  inventoryId: string,
  body: {
    availableQty?: number;
    reservedQty?: number;
    reorderQty?: number;
  },
) {
  return fetchApi<InventoryItem>(`/api/inventory/${inventoryId}`, {
    managerSession,
    method: "PATCH",
    body,
  });
}

export function createInventoryReorder(
  managerSession: ManagerSession,
  inventoryId: string,
  body: { requestedQty: number },
) {
  return fetchApi<StockReorder>(`/api/inventory/${inventoryId}/reorder`, {
    managerSession,
    method: "POST",
    body,
  });
}
export function fetchReorders(mode: "current" | "history" = "current") {
  return fetchApi<StockReorder[]>(`/api/reorder?mode=${mode}`);
}

export function updateReorderStatus(
  reorderId: string,
  status: "COMPLETED" | "CANCELLED",
) {
  return fetchApi<null>(`/api/reorder/${reorderId}/status`, {
    method: "PATCH",
    body: { status },
  });
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

export function fetchWarehouses(status: StatusFilter = "active") {
  return fetchApi<Warehouse[]>(`/warehouse/warehouses?status=${status}`);
}

export function createWarehouse(body: {
  name: string;
  city: string;
  pincode: string;
}) {
  return fetchApi<Warehouse>("/warehouse", {
    method: "POST",
    body,
  });
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

export function deleteProduct(productId: string, reason: string) {
  return fetchApi<null>(`/api/product/${productId}`, {
    method: "DELETE",
    body: { reason },
  });
}

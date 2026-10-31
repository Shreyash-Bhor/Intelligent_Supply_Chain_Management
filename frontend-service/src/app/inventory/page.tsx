"use client";

import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { useAuthSession } from "@/hooks/useAuthSession";
import {
  createInventory,
  createInventoryReorder,
  fetchInventoryPage,
  updateInventory,
  searchProducts,
  fetchWarehouses,
  type InventoryItem,
  type ManagerSession,
  type Product,
  type Warehouse,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/Pagination";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const SESSION_KEY = "warehouse_manager_session";
const INVENTORY_PAGE_SIZE = 50;

export default function InventoryPage() {
  const router = useRouter();
  const { session: authSession, hydrated } = useAuthSession();
  const [session, setSession] = useState<ManagerSession | null>(null);
  const [inventories, setInventories] = useState<InventoryItem[]>([]);
  const [inventoryTotal, setInventoryTotal] = useState(0);
  const [products, setProducts] = useState<Array<Pick<Product, "id" | "name" | "sku">>>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [productId, setProductId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [productQuery, setProductQuery] = useState("");
  const [debouncedCreateProductQuery, setDebouncedCreateProductQuery] = useState("");
  const [warehouseQuery, setWarehouseQuery] = useState("");
  const [availableQty, setAvailableQty] = useState("0");
  const [reservedQty, setReservedQty] = useState("0");
  const [reorderQty, setReorderQty] = useState("10");
  const [requestQtyByInventory, setRequestQtyByInventory] = useState<
    Record<string, string>
  >({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [warehouseFilter, setWarehouseFilter] = useState("all");
  const [stockStatusFilter, setStockStatusFilter] = useState<
    "all" | "healthy" | "low"
  >("all");
  const [productSearch, setProductSearch] = useState("");
  const [debouncedProductSearch, setDebouncedProductSearch] = useState("");
  const [page, setPage] = useState(1);
  const inventoryRequestSequence = useRef(0);
  const productLookupSequence = useRef(0);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedProductSearch(productSearch.trim());
    }, 350);
    return () => window.clearTimeout(timeout);
  }, [productSearch]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedCreateProductQuery(productQuery.trim());
    }, 300);
    return () => window.clearTimeout(timeout);
  }, [productQuery]);

  useEffect(() => {
    const stored = window.localStorage.getItem(SESSION_KEY);
    if (!stored) return;

    try {
      const parsed = JSON.parse(stored) as ManagerSession;
      if (parsed.email && parsed.accessKey) {
        setSession(parsed);
      }
    } catch {
      window.localStorage.removeItem(SESSION_KEY);
    }
  }, []);

  const loadData = useCallback(async () => {
    if (!session) return;
    const requestSequence = ++inventoryRequestSequence.current;

    try {
      setLoading(true);
      const inventoryPage = await fetchInventoryPage(
        session,
        page,
        INVENTORY_PAGE_SIZE,
        { warehouseId: warehouseFilter, productQuery: debouncedProductSearch },
      );

      if (requestSequence !== inventoryRequestSequence.current) return;
      setInventories(inventoryPage.items);
      setInventoryTotal(inventoryPage.pagination.total);
      setError(null);
    } catch (err) {
      if (requestSequence !== inventoryRequestSequence.current) return;
      setError(
        err instanceof Error ? err.message : "Failed to load inventory data",
      );
    } finally {
      if (requestSequence === inventoryRequestSequence.current) setLoading(false);
    }
  }, [session, page, warehouseFilter, debouncedProductSearch]);

  const loadReferenceData = useCallback(async () => {
    if (!session) return;
    try {
      const warehouseData = await fetchWarehouses("active");
      setWarehouses(warehouseData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load options");
    }
  }, [session]);

  useEffect(() => {
    const requestSequence = ++productLookupSequence.current;
    if (!session || !debouncedCreateProductQuery) {
      setProducts([]);
      return;
    }
    void searchProducts(debouncedCreateProductQuery)
      .then((matches) => {
        if (requestSequence === productLookupSequence.current) setProducts(matches);
      })
      .catch((err: unknown) => {
        if (requestSequence === productLookupSequence.current) {
          setError(err instanceof Error ? err.message : "Failed to search products");
        }
      });
  }, [session, debouncedCreateProductQuery]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    void loadReferenceData();
  }, [loadReferenceData]);

  const inventoryStats = useMemo(() => {
    const flagged = inventories.filter((item) => item.isReorderPending).length;
    const lowStock = inventories.filter(
      (item) => item.availableQty <= item.reorderQty,
    ).length;

    return {
      total: inventoryTotal,
      lowStock,
      flagged,
    };
  }, [inventories, inventoryTotal]);

  const filteredInventories = useMemo(
    () => inventories
      .filter((inventory) => warehouseFilter === "all" || inventory.warehouseId === warehouseFilter)
      .filter((inventory) => {
        if (stockStatusFilter === "all") return true;
        const low = inventory.availableQty <= inventory.reorderQty;
        return stockStatusFilter === "low" ? low : !low;
      }),
    [inventories, warehouseFilter, stockStatusFilter],
  );
  const productOptionMap = useMemo(() => {
    return products.reduce<Record<string, string>>((acc, product) => {
      acc[`${product.name} (${product.sku})`] = product.id;
      return acc;
    }, {});
  }, [products]);

  const warehouseOptionMap = useMemo(() => {
    return warehouses.reduce<Record<string, string>>((acc, warehouse) => {
      acc[`${warehouse.name} - ${warehouse.city}`] = warehouse.id;
      return acc;
    }, {});
  }, [warehouses]);
  const handleCreateReorder = async (inventoryId: string) => {
    if (!session) return;

    try {
      setLoading(true);
      await createInventoryReorder(session, inventoryId, {
        requestedQty: Number(requestQtyByInventory[inventoryId] ?? "0"),
      });
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create reorder");
      setLoading(false);
    }
  };
  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!session) return;

    if (!productId || !warehouseId) {
      setError("Please select a valid product and warehouse from suggestions.");
      return;
    }

    try {
      setLoading(true);
      await createInventory(session, {
        productId,
        warehouseId,
        availableQty: Number(availableQty),
        reservedQty: Number(reservedQty),
        reorderQty: Number(reorderQty),
      });

      setProductId("");
      setWarehouseId("");
      setProductQuery("");
      setWarehouseQuery("");
      setAvailableQty("0");
      setReservedQty("0");
      setReorderQty("10");
      await loadData();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to create inventory",
      );
      setLoading(false);
    }
  };

  const handleInventoryUpdate = async (inventory: InventoryItem) => {
    if (!session) return;

    try {
      setLoading(true);
      await updateInventory(session, inventory.id, {
        availableQty: inventory.availableQty,
        reservedQty: inventory.reservedQty,
        reorderQty: inventory.reorderQty,
      });
      setEditingId(null);
      await loadData();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to update inventory",
      );
      setLoading(false);
    }
  };

  const activePage = page;

  const updateLocalInventory = (
    inventoryId: string,
    key: "availableQty" | "reservedQty" | "reorderQty",
    value: number,
  ) => {
    setInventories((prev) =>
      prev.map((item) =>
        item.id === inventoryId ? { ...item, [key]: value } : item,
      ),
    );
  };

  useEffect(() => {
    if (!hydrated) return;
    if (authSession?.role === "user") {
      router.replace("/user");
    }
  }, [authSession, hydrated, router]);

  if (!hydrated) {
    return null;
  }

  if (!session) {
    return (
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-4 px-6 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Manager session required</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm">
              Please login from the dashboard page first to manage inventory and
              automated reorder operations.
            </p>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-8">
      <section className="grid gap-3 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground text-sm">Inventory Records</p>
            <p className="text-2xl font-semibold">{inventoryStats.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground text-sm">Low Stock Items</p>
            <p className="text-2xl font-semibold">{inventoryStats.lowStock}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground text-sm">Pending Reorders</p>
            <p className="text-2xl font-semibold">{inventoryStats.flagged}</p>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Create Inventory Record</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="grid gap-3 md:grid-cols-4">
            <div className="flex flex-col gap-1.5 md:col-span-2">
              <label htmlFor="inventory-product" className="text-sm font-medium">Existing product</label>
              <input
                id="inventory-product"
                className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
                list="inventory-product-options"
                value={productQuery}
                onChange={(event) => {
                  const nextLabel = event.target.value;
                  setProductQuery(nextLabel);
                  setProductId(productOptionMap[nextLabel] ?? "");
                }}
                placeholder="Choose existing product by name or SKU"
                required
              />
              <datalist id="inventory-product-options">
                {products.map((product) => {
                  const optionLabel = `${product.name} (${product.sku})`;
                  return <option key={product.id} value={optionLabel} />;
                })}
              </datalist>
            </div>
            <div className="flex flex-col gap-1.5 md:col-span-2">
              <label htmlFor="inventory-warehouse" className="text-sm font-medium">Warehouse</label>
              <input
                id="inventory-warehouse"
                className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
                list="inventory-warehouse-options"
                value={warehouseQuery}
                onChange={(event) => {
                  const nextLabel = event.target.value;
                  setWarehouseQuery(nextLabel);
                  setWarehouseId(warehouseOptionMap[nextLabel] ?? "");
                }}
                placeholder="Search warehouse by name or city"
                required
              />
              <datalist id="inventory-warehouse-options">
                {warehouses.map((warehouse) => {
                  const optionLabel = `${warehouse.name} - ${warehouse.city}`;
                  return <option key={warehouse.id} value={optionLabel} />;
                })}
              </datalist>
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="inventory-available" className="text-sm font-medium">Available quantity</label>
              <input id="inventory-available" className="border-input bg-background rounded-md border px-3 py-2 text-sm" type="number" min={0} value={availableQty} onChange={(event) => setAvailableQty(event.target.value)} required />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="inventory-reserved" className="text-sm font-medium">Reserved quantity</label>
              <input id="inventory-reserved" className="border-input bg-background rounded-md border px-3 py-2 text-sm" type="number" min={0} value={reservedQty} onChange={(event) => setReservedQty(event.target.value)} required />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="inventory-reorder" className="text-sm font-medium">Reorder threshold</label>
              <input id="inventory-reorder" className="border-input bg-background rounded-md border px-3 py-2 text-sm" type="number" min={0} value={reorderQty} onChange={(event) => setReorderQty(event.target.value)} required />
            </div>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving..." : "Create"}
            </Button>{" "}
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Search Product Inventory</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              type="search"
              aria-label="Search inventory by product name or SKU"
              placeholder="Enter a product name or SKU"
              className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm sm:max-w-md"
              value={productSearch}
              onChange={(event) => {
                setPage(1);
                setProductSearch(event.target.value);
              }}
            />
            {productSearch ? (
              <Button type="button" variant="outline" onClick={() => {
                setPage(1);
                setProductSearch("");
              }}>
                Clear search
              </Button>
            ) : null}
          </div>
          <p className="text-muted-foreground mt-2 text-sm">
            Search is separate from creating inventory records. Results show inventory for matching products.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>Inventory & Reorder Triggers</CardTitle>

          <div className="flex flex-wrap gap-2">
            <select
              className="border-input bg-background rounded-md border px-3 py-2 text-sm"
              value={warehouseFilter}
              onChange={(event) => {
                setPage(1);
                setWarehouseFilter(event.target.value);
              }}
            >
              <option value="all">All Warehouses</option>
              {warehouses.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.name}
                </option>
              ))}
            </select>

            <select
              className="border-input bg-background rounded-md border px-3 py-2 text-sm"
              value={stockStatusFilter}
              onChange={(event) =>
                {
                  setPage(1);
                  setStockStatusFilter(event.target.value as "all" | "healthy" | "low");
                }
              }
            >
              <option value="all">All Stock Status</option>
              <option value="healthy">Healthy</option>
              <option value="low">Low Stock</option>
            </select>
          </div>
        </CardHeader>

        <CardContent>
          {error ? (
            <p className="text-destructive mb-3 text-sm">{error}</p>
          ) : null}

          <div className="scrollbar-hidden max-h-[32rem] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Warehouse</TableHead>
                  <TableHead>Available</TableHead>
                  <TableHead>Reserved</TableHead>
                  <TableHead>Reorder Level</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {filteredInventories.map((inventory) => {
                    const isLow =
                      inventory.availableQty <= inventory.reorderQty;
                    const currentQty =
                      requestQtyByInventory[inventory.id] ?? "0";
                    const editing = editingId === inventory.id;

                    return (
                      <TableRow key={inventory.id}>
                        <TableCell>
                          <p className="font-medium">
                            {inventory.product.name}
                          </p>
                          <p className="text-muted-foreground text-xs">
                            {inventory.product.sku}
                          </p>
                        </TableCell>
                        <TableCell>{inventory.warehouse.name}</TableCell>
                        <TableCell>
                          {editing ? (
                            <input
                              type="number"
                              min={0}
                              className="border-input bg-background w-24 rounded-md border px-2 py-1 text-sm"
                              value={inventory.availableQty}
                              onChange={(event) =>
                                updateLocalInventory(
                                  inventory.id,
                                  "availableQty",
                                  Number(event.target.value),
                                )
                              }
                            />
                          ) : (
                            inventory.availableQty
                          )}
                        </TableCell>
                        <TableCell>
                          {editing ? (
                            <input
                              type="number"
                              min={0}
                              className="border-input bg-background w-24 rounded-md border px-2 py-1 text-sm"
                              value={inventory.reservedQty}
                              onChange={(event) =>
                                updateLocalInventory(
                                  inventory.id,
                                  "reservedQty",
                                  Number(event.target.value),
                                )
                              }
                            />
                          ) : (
                            inventory.reservedQty
                          )}
                        </TableCell>
                        <TableCell>
                          {editing ? (
                            <input
                              type="number"
                              min={0}
                              className="border-input bg-background w-24 rounded-md border px-2 py-1 text-sm"
                              value={inventory.reorderQty}
                              onChange={(event) =>
                                updateLocalInventory(
                                  inventory.id,
                                  "reorderQty",
                                  Number(event.target.value),
                                )
                              }
                            />
                          ) : (
                            inventory.reorderQty
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              inventory.isReorderPending
                                ? "secondary"
                                : "outline"
                            }
                          >
                            {inventory.isReorderPending
                              ? "Reorder Pending"
                              : isLow
                                ? "Low Stock"
                                : "Healthy"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            {editing ? (
                              <>
                                <Button
                                  size="sm"
                                  onClick={() =>
                                    void handleInventoryUpdate(inventory)
                                  }
                                  disabled={loading}
                                >
                                  Save
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setEditingId(null)}
                                  disabled={loading}
                                >
                                  Cancel
                                </Button>
                              </>
                            ) : (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setEditingId(inventory.id)}
                                  disabled={loading}
                                >
                                  Edit
                                </Button>
                                <input
                                  type="number"
                                  min={1}
                                  className="border-input bg-background w-24 rounded-md border px-2 py-1 text-sm"
                                  value={currentQty}
                                  onChange={(event) =>
                                    setRequestQtyByInventory((prev) => ({
                                      ...prev,
                                      [inventory.id]: event.target.value,
                                    }))
                                  }
                                />
                                <Button
                                  size="sm"
                                  onClick={() =>
                                    void handleCreateReorder(inventory.id)
                                  }
                                  disabled={
                                    loading || inventory.isReorderPending
                                  }
                                >
                                  Request
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}

                {!filteredInventories.length ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="text-muted-foreground text-center"
                    >
                      {loading
                        ? "Loading inventory..."
                        : "No inventory records found"}
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>
          <Pagination
            page={activePage}
            totalItems={inventoryTotal}
            pageSize={INVENTORY_PAGE_SIZE}
            onPageChange={(nextPage) => { setPage(nextPage); }}
          />
        </CardContent>
      </Card>
    </main>
  );
}

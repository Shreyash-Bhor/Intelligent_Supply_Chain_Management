"use client";

import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  createInventory,
  createInventoryReorder,
  fetchInventory,
  updateInventory,
  fetchProducts,
  fetchWarehouses,
  type InventoryItem,
  type ManagerSession,
  type Product,
  type Warehouse,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
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

export default function InventoryPage() {
  const [session, setSession] = useState<ManagerSession | null>(null);
  const [inventories, setInventories] = useState<InventoryItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [productId, setProductId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [productQuery, setProductQuery] = useState("");
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

    try {
      setLoading(true);
      const [inventoryData, productData, warehouseData] = await Promise.all([
        fetchInventory(session),
        fetchProducts("active"),
        fetchWarehouses("active"),
      ]);

      setInventories(inventoryData);
      setProducts(productData);
      setWarehouses(warehouseData);
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load inventory data",
      );
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const inventoryStats = useMemo(() => {
    const flagged = inventories.filter((item) => item.isReorderPending).length;
    const lowStock = inventories.filter(
      (item) => item.availableQty <= item.reorderQty,
    ).length;

    return {
      total: inventories.length,
      lowStock,
      flagged,
    };
  }, [inventories]);

  const filteredInventories = useMemo(
    () =>
      inventories
        .filter((inventory) =>
          warehouseFilter === "all"
            ? true
            : inventory.warehouse.name === warehouseFilter,
        )
        .filter((inventory) => {
          if (stockStatusFilter === "all") return true;
          const isLow = inventory.availableQty <= inventory.reorderQty;
          return stockStatusFilter === "low" ? isLow : !isLow;
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
          <form onSubmit={handleCreate} className="grid gap-3 md:grid-cols-8">
            <div className="md:col-span-2">
              <input
                className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
                list="inventory-product-options"
                value={productQuery}
                onChange={(event) => {
                  const nextLabel = event.target.value;
                  setProductQuery(nextLabel);
                  setProductId(productOptionMap[nextLabel] ?? "");
                }}
                placeholder="Search product by name or SKU"
                required
              />
              <datalist id="inventory-product-options">
                {products.map((product) => {
                  const optionLabel = `${product.name} (${product.sku})`;
                  return <option key={product.id} value={optionLabel} />;
                })}
              </datalist>
            </div>
            <div className="md:col-span-2">
              <input
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
            <input
              className="border-input bg-background rounded-md border px-3 py-2 text-sm"
              type="number"
              min={0}
              value={availableQty}
              onChange={(event) => setAvailableQty(event.target.value)}
              placeholder="Available"
              required
            />
            <input
              className="border-input bg-background rounded-md border px-3 py-2 text-sm"
              type="number"
              min={0}
              value={reservedQty}
              onChange={(event) => setReservedQty(event.target.value)}
              placeholder="Reserved"
              required
            />
            <input
              className="border-input bg-background rounded-md border px-3 py-2 text-sm"
              type="number"
              min={0}
              value={reorderQty}
              onChange={(event) => setReorderQty(event.target.value)}
              placeholder="Reorder threshold"
              required
            />
            <Button type="submit" disabled={loading}>
              {loading ? "Saving..." : "Create"}
            </Button>{" "}
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>Inventory & Reorder Triggers</CardTitle>

          <div className="flex flex-wrap gap-2">
            <select
              className="border-input bg-background rounded-md border px-3 py-2 text-sm"
              value={warehouseFilter}
              onChange={(event) => setWarehouseFilter(event.target.value)}
            >
              <option value="all">All Warehouses</option>
              {warehouses.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.name}>
                  {warehouse.name}
                </option>
              ))}
            </select>

            <select
              className="border-input bg-background rounded-md border px-3 py-2 text-sm"
              value={stockStatusFilter}
              onChange={(event) =>
                setStockStatusFilter(
                  event.target.value as "all" | "healthy" | "low",
                )
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
                {filteredInventories.slice(0, 10).map((inventory) => {
                  const isLow = inventory.availableQty <= inventory.reorderQty;
                  const currentQty = requestQtyByInventory[inventory.id] ?? "0";
                  const editing = editingId === inventory.id;

                  return (
                    <TableRow key={inventory.id}>
                      <TableCell>
                        <p className="font-medium">{inventory.product.name}</p>
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
                            inventory.isReorderPending ? "secondary" : "outline"
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
                                disabled={loading || inventory.isReorderPending}
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
        </CardContent>
      </Card>
    </main>
  );
}

"use client";

import { type FormEvent, useCallback, useEffect, useState } from "react";
import {
  createWarehouse,
  fetchWarehouses,
  updateWarehouse,
  updateWarehouseStatus,
  type StatusFilter,
  type Warehouse,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function WarehousePage() {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [pincode, setPincode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active");

  const loadWarehouses = useCallback(
    async (filter: StatusFilter = statusFilter) => {
      try {
        setLoading(true);
        const data = await fetchWarehouses(filter);
        setWarehouses(data);
        setError(null);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to fetch warehouses",
        );
      } finally {
        setLoading(false);
      }
    },
    [statusFilter],
  );

  useEffect(() => {
    void loadWarehouses(statusFilter);
  }, [loadWarehouses, statusFilter]);

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      setLoading(true);
      await createWarehouse({
        name: name.trim(),
        city: city.trim(),
        pincode: pincode.trim(),
      });
      setName("");
      setCity("");
      setPincode("");
      await loadWarehouses();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to create warehouse",
      );
      setLoading(false);
    }
  };

  const handleUpdate = async (warehouse: Warehouse) => {
    try {
      setLoading(true);
      await updateWarehouse(warehouse.id, {
        name: warehouse.name.trim(),
        city: warehouse.city.trim(),
        pincode: warehouse.pincode.trim(),
      });
      setEditingId(null);
      await loadWarehouses();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to update warehouse",
      );
      setLoading(false);
    }
  };

  const handleToggleStatus = async (warehouse: Warehouse) => {
    try {
      setLoading(true);
      await updateWarehouseStatus(warehouse.id, !warehouse.isActive);
      await loadWarehouses();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to change status");
      setLoading(false);
    }
  };

  const updateLocalWarehouse = (
    warehouseId: string,
    key: "name" | "city" | "pincode",
    value: string,
  ) => {
    setWarehouses((prev) =>
      prev.map((warehouse) =>
        warehouse.id === warehouseId
          ? { ...warehouse, [key]: value }
          : warehouse,
      ),
    );
  };

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-8">
      <Card>
        <CardHeader>
          <CardTitle>Create Warehouse</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="grid gap-3 md:grid-cols-4">
            <input
              className="border-input bg-background rounded-md border px-3 py-2 text-sm"
              placeholder="Warehouse name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
            />
            <input
              className="border-input bg-background rounded-md border px-3 py-2 text-sm"
              placeholder="City"
              value={city}
              onChange={(event) => setCity(event.target.value)}
              required
            />
            <input
              className="border-input bg-background rounded-md border px-3 py-2 text-sm"
              placeholder="Pincode"
              value={pincode}
              maxLength={6}
              onChange={(event) => setPincode(event.target.value)}
              required
            />
            <Button type="submit" disabled={loading}>
              {loading ? "Saving..." : "Add Warehouse"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>Warehouses</CardTitle>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant={statusFilter === "active" ? "default" : "outline"}
              onClick={() => setStatusFilter("active")}
            >
              Active
            </Button>
            <Button
              size="sm"
              variant={statusFilter === "inactive" ? "default" : "outline"}
              onClick={() => setStatusFilter("inactive")}
            >
              Deactivated
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {error ? (
            <p className="text-destructive mb-3 text-sm">{error}</p>
          ) : null}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>City</TableHead>
                <TableHead>Pincode</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {warehouses.map((warehouse) => {
                const editing = editingId === warehouse.id;
                return (
                  <TableRow key={warehouse.id}>
                    <TableCell>
                      {editing ? (
                        <input
                          className="border-input bg-background w-full rounded-md border px-2 py-1 text-sm"
                          value={warehouse.name}
                          onChange={(event) =>
                            updateLocalWarehouse(
                              warehouse.id,
                              "name",
                              event.target.value,
                            )
                          }
                        />
                      ) : (
                        warehouse.name
                      )}
                    </TableCell>
                    <TableCell>
                      {editing ? (
                        <input
                          className="border-input bg-background w-full rounded-md border px-2 py-1 text-sm"
                          value={warehouse.city}
                          onChange={(event) =>
                            updateLocalWarehouse(
                              warehouse.id,
                              "city",
                              event.target.value,
                            )
                          }
                        />
                      ) : (
                        warehouse.city
                      )}
                    </TableCell>
                    <TableCell>
                      {editing ? (
                        <input
                          className="border-input bg-background w-full rounded-md border px-2 py-1 text-sm"
                          value={warehouse.pincode}
                          maxLength={6}
                          onChange={(event) =>
                            updateLocalWarehouse(
                              warehouse.id,
                              "pincode",
                              event.target.value,
                            )
                          }
                        />
                      ) : (
                        warehouse.pincode
                      )}
                    </TableCell>
                    <TableCell>
                      {warehouse.isActive ? "Active" : "Inactive"}
                    </TableCell>
                    <TableCell className="space-x-2 text-right">
                      {editing ? (
                        <>
                          <Button
                            size="sm"
                            onClick={() => void handleUpdate(warehouse)}
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
                            onClick={() => setEditingId(warehouse.id)}
                          >
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => void handleToggleStatus(warehouse)}
                            disabled={loading}
                          >
                            {warehouse.isActive ? "Deactivate" : "Activate"}
                          </Button>
                        </>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
              {!warehouses.length ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="text-muted-foreground text-center"
                  >
                    {loading
                      ? "Loading warehouses..."
                      : "No warehouses found for selected filter"}
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </main>
  );
}

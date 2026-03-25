"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import {
  createProduct,
  deleteProduct,
  fetchProducts,
  updateProduct,
  updateProductStatus,
  type Product,
  type StatusFilter,
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

export default function ProductPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active");
  const [search, setSearch] = useState("");

  const loadProducts = useCallback(
    async (filter: StatusFilter = statusFilter) => {
      try {
        setLoading(true);
        const data = await fetchProducts(filter);
        setProducts(data);
        setError(null);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to fetch products",
        );
      } finally {
        setLoading(false);
      }
    },
    [statusFilter],
  );

  useEffect(() => {
    void loadProducts(statusFilter);
  }, [loadProducts, statusFilter]);

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      setLoading(true);
      await createProduct({ name: name.trim(), sku: sku.trim() });
      setName("");
      setSku("");
      await loadProducts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create product");
      setLoading(false);
    }
  };

  const handleUpdate = async (product: Product) => {
    if (!product.name.trim() || !product.sku.trim()) {
      setError("Name and SKU are required");
      return;
    }

    try {
      setLoading(true);
      await updateProduct(product.id, {
        name: product.name.trim(),
        sku: product.sku.trim(),
      });
      setEditingId(null);
      await loadProducts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update product");
      setLoading(false);
    }
  };

  const handleDelete = async (productId: string) => {
    try {
      setLoading(true);
      await deleteProduct(productId, "NO_LONGER_NEEDED");
      await loadProducts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete product");
      setLoading(false);
    }
  };

  const handleToggleStatus = async (product: Product) => {
    try {
      setLoading(true);
      await updateProductStatus(product.id, !product.isActive);
      await loadProducts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to change status");
      setLoading(false);
    }
  };

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return products;

    return products.filter(
      (product) =>
        product.name.toLowerCase().includes(query) ||
        product.sku.toLowerCase().includes(query),
    );
  }, [products, search]);

  const updateLocalProduct = (
    productId: string,
    key: "name" | "sku",
    value: string,
  ) => {
    setProducts((prev) =>
      prev.map((product) =>
        product.id === productId ? { ...product, [key]: value } : product,
      ),
    );
  };

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-8">
      <Card>
        <CardHeader>
          <CardTitle>Create Product</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="grid gap-3 md:grid-cols-4">
            <input
              className="border-input bg-background rounded-md border px-3 py-2 text-sm"
              placeholder="Product name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
            />
            <input
              className="border-input bg-background rounded-md border px-3 py-2 text-sm"
              placeholder="SKU"
              value={sku}
              onChange={(event) => setSku(event.target.value)}
              required
            />
            <Button type="submit" disabled={loading} className="md:col-span-2">
              {loading ? "Saving..." : "Add Product"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>Products</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <input
              className="border-input bg-background rounded-md border px-3 py-2 text-sm"
              placeholder="Search by name or SKU"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
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

          <div className="scrollbar-hidden max-h-[32rem] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {filteredProducts.slice(0, 10).map((product) => {
                  const editing = editingId === product.id;

                  return (
                    <TableRow key={product.id}>
                      <TableCell>
                        {editing ? (
                          <input
                            className="border-input bg-background w-full rounded-md border px-2 py-1 text-sm"
                            value={product.name}
                            onChange={(event) =>
                              updateLocalProduct(
                                product.id,
                                "name",
                                event.target.value,
                              )
                            }
                          />
                        ) : (
                          product.name
                        )}
                      </TableCell>

                      <TableCell>
                        {editing ? (
                          <input
                            className="border-input bg-background w-full rounded-md border px-2 py-1 text-sm"
                            value={product.sku}
                            onChange={(event) =>
                              updateLocalProduct(
                                product.id,
                                "sku",
                                event.target.value,
                              )
                            }
                          />
                        ) : (
                          product.sku
                        )}
                      </TableCell>

                      <TableCell>
                        {product.isActive ? "Active" : "Inactive"}
                      </TableCell>

                      <TableCell className="space-x-2 text-right">
                        {editing ? (
                          <>
                            <Button
                              size="sm"
                              onClick={() => void handleUpdate(product)}
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
                              onClick={() => setEditingId(product.id)}
                            >
                              Edit
                            </Button>

                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => void handleToggleStatus(product)}
                              disabled={loading}
                            >
                              {product.isActive ? "Deactivate" : "Activate"}
                            </Button>

                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => void handleDelete(product.id)}
                              disabled={loading}
                            >
                              Delete
                            </Button>
                          </>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}

                {!filteredProducts.length ? (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="text-muted-foreground text-center"
                    >
                      {loading
                        ? "Loading products..."
                        : "No products found for selected filter"}
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

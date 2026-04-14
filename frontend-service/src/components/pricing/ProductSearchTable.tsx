import { Search, ShoppingBag } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Product } from "@/lib/api";

type ProductSearchTableProps = {
  products: Product[];
  search: string;
  onSearchChange: (value: string) => void;
  selectedProductId: string | null;
  onSelectProduct: (product: Product) => void;
};

export function ProductSearchTable({
  products,
  search,
  onSearchChange,
  selectedProductId,
  onSelectProduct,
}: ProductSearchTableProps) {
  return (
    <Card className="mx-auto w-full max-w-3xl">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle className="flex items-center gap-2 text-base">
          <ShoppingBag className="text-primary size-4" aria-hidden="true" />
          Find Product
        </CardTitle>
        <label className="relative w-full sm:w-72">
          <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <input
            className="border-input bg-background h-9 w-full rounded-md border pr-3 pl-9 text-sm"
            placeholder="Search SKU or product"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
          />
        </label>
      </CardHeader>
      <CardContent>
        <div className="scrollbar-hidden max-h-72 overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((product) => {
                const isSelected = selectedProductId === product.id;
                return (
                  <TableRow key={product.id}>
                    <TableCell className="max-w-[180px] truncate">
                      {product.name}
                    </TableCell>
                    <TableCell>{product.sku}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant={isSelected ? "default" : "outline"}
                        onClick={() => onSelectProduct(product)}
                      >
                        {isSelected ? "Selected" : "Select"}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

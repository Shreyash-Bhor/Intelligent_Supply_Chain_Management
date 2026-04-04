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
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle>Find Product</CardTitle>
        <input
          className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm sm:w-80"
          placeholder="Search by SKU or product name"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
        />
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
                    <TableCell>{product.name}</TableCell>
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

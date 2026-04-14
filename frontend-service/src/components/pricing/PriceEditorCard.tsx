import { type FormEvent } from "react";
import { IndianRupee, Package2, PencilLine, Save } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { Product, ProductPrice } from "@/lib/api";

type PriceEditorCardProps = {
  product: Product | null;
  currentPrice: ProductPrice | null;
  priceInput: string;
  loading: boolean;
  onPriceChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

export function PriceEditorCard({
  product,
  currentPrice,
  priceInput,
  loading,
  onPriceChange,
  onSubmit,
}: PriceEditorCardProps) {
  return (
    <Card className="from-background to-primary/5 mx-auto w-full max-w-4xl border bg-gradient-to-br shadow-md">
      <CardHeader className="border-b pb-5">
        <CardTitle className="flex items-center gap-2 text-lg">
          <PencilLine className="text-primary size-5" aria-hidden="true" />
          Add / Update Price
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!product ? (
          <p className="text-muted-foreground text-sm">
            Select a product to add or update pricing.
          </p>
        ) : (
          <>
            <div className="bg-muted/50 mb-4 rounded-xl border p-4 text-sm">
              <p className="mb-1 flex items-center gap-2 font-medium">
                <Package2 className="size-4" aria-hidden="true" />
                {product.name}
              </p>
              <p className="text-muted-foreground">SKU: {product.sku}</p>
              <p className="mt-2 flex items-center gap-1.5 font-medium">
                <IndianRupee className="size-4" aria-hidden="true" />
                Current Price:{" "}
                {currentPrice ? currentPrice.price.toFixed(2) : "Not set"}
              </p>
            </div>
            <form
              onSubmit={onSubmit}
              className="grid gap-3 sm:grid-cols-[1fr_auto]"
            >
              <label className="relative block">
                <IndianRupee className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                <input
                  className="border-input bg-background h-10 w-full rounded-lg border pr-3 pl-9 text-sm"
                  placeholder="Enter price (e.g. 1999.00)"
                  value={priceInput}
                  onChange={(event) => onPriceChange(event.target.value)}
                  inputMode="decimal"
                  required
                />
              </label>
              <Button type="submit" disabled={loading} className="rounded-lg">
                <Save className="size-4" aria-hidden="true" />
                {loading
                  ? "Saving..."
                  : currentPrice
                    ? "Update Price"
                    : "Add Price"}
              </Button>
            </form>
            <p className="text-muted-foreground mt-3 text-xs">
              Currency is fixed to INR for all pricing entries.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

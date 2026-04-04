import { type FormEvent } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { Product, ProductPrice } from "@/lib/api";

type PriceEditorCardProps = {
  product: Product | null;
  currentPrice: ProductPrice | null;
  priceInput: string;
  currencyInput: string;
  loading: boolean;
  onPriceChange: (value: string) => void;
  onCurrencyChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

export function PriceEditorCard({
  product,
  currentPrice,
  priceInput,
  currencyInput,
  loading,
  onPriceChange,
  onCurrencyChange,
  onSubmit,
}: PriceEditorCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Add / Update Price</CardTitle>
      </CardHeader>
      <CardContent>
        {!product ? (
          <p className="text-muted-foreground text-sm">
            Select a product to add or update pricing.
          </p>
        ) : (
          <>
            <div className="mb-4 rounded-md border p-3 text-sm">
              <p className="font-medium">{product.name}</p>
              <p className="text-muted-foreground">SKU: {product.sku}</p>
              <p className="mt-2">
                Current Price:{" "}
                {currentPrice
                  ? `${currentPrice.currency} ${currentPrice.price.toFixed(2)}`
                  : "Not set"}
              </p>
            </div>
            <form onSubmit={onSubmit} className="grid gap-3 md:grid-cols-3">
              <input
                className="border-input bg-background rounded-md border px-3 py-2 text-sm"
                placeholder="Price (e.g. 199.99)"
                value={priceInput}
                onChange={(event) => onPriceChange(event.target.value)}
                inputMode="decimal"
                required
              />
              <input
                className="border-input bg-background rounded-md border px-3 py-2 text-sm"
                placeholder="Currency (USD)"
                value={currencyInput}
                onChange={(event) => onCurrencyChange(event.target.value)}
                maxLength={3}
                required
              />
              <Button type="submit" disabled={loading}>
                {loading
                  ? "Saving..."
                  : currentPrice
                    ? "Update Price"
                    : "Add Price"}
              </Button>
            </form>
          </>
        )}
      </CardContent>
    </Card>
  );
}

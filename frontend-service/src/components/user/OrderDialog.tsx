"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { PackageCheck, ShoppingCart, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCurrency, type UserCatalogProduct } from "@/lib/userCatalog";

type Props = {
  product: UserCatalogProduct;
  onAddToCart: (quantity: number) => void;
  onClose: () => void;
};

export function OrderDialog({ product, onAddToCart, onClose }: Props) {
  const [quantity, setQuantity] = useState(1);
  const total = useMemo(
    () =>
      product.price === null
        ? null
        : Number((product.price * quantity).toFixed(2)),
    [product.price, quantity],
  );

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) =>
      event.key === "Escape" && onClose();
    window.addEventListener("keydown", closeOnEscape);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", closeOnEscape);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 p-3 backdrop-blur-sm"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="order-title"
        className="bg-background relative flex h-[75vh] w-[75vw] min-w-[min(94vw,320px)] max-w-6xl overflow-hidden rounded-2xl border shadow-2xl max-md:h-[90vh] max-md:w-[94vw] max-md:flex-col"
      >
        <Button
          variant="outline"
          size="icon"
          className="absolute right-4 top-4 z-10 rounded-full"
          onClick={onClose}
          aria-label="Close order dialog"
        >
          <X />
        </Button>
        <div className="bg-muted/30 relative min-h-56 flex-1">
          {product.imageUrl ? (
            <Image
              src={product.imageUrl}
              alt={product.name}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 94vw, 38vw"
            />
          ) : (
            <div className="text-muted-foreground flex h-full items-center justify-center">
              <ShoppingCart className="size-16" />
            </div>
          )}
        </div>
        <div className="flex flex-1 flex-col overflow-y-auto p-6 md:p-10">
            <div className="flex h-full flex-col">
              <div className="space-y-3 pr-10">
                <p className="text-primary text-sm font-medium">
                  Product details
                </p>
                <h2
                  id="order-title"
                  className="text-3xl font-semibold tracking-tight"
                >
                  {product.name}
                </h2>
                <p className="text-muted-foreground">{product.description}</p>
                <p className="text-muted-foreground text-sm">SKU {product.sku} · {product.category}</p>
              </div>
              <div className="mt-6 grid gap-3 rounded-xl border p-4 sm:grid-cols-2">
                <div>
                  <p className="text-muted-foreground text-xs uppercase">
                    Unit price
                  </p>
                  <p className="text-lg font-semibold">
                    {formatCurrency(product.price, product.currency)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs uppercase">
                    Available now
                  </p>
                  <p className="text-lg font-semibold">
                    {product.availableQty} units
                  </p>
                </div>
              </div>
              <div className="mt-6 space-y-2">
                <label htmlFor="order-quantity" className="text-sm font-medium">
                  Quantity
                </label>
                <input
                  id="order-quantity"
                  type="number"
                  min={1}
                  max={100000}
                  value={quantity}
                  onChange={(event) =>
                    setQuantity(
                      Math.max(1, Number.parseInt(event.target.value, 10) || 1),
                    )
                  }
                  className="border-input bg-background w-full rounded-md border px-3 py-3 text-lg"
                />
              </div>
              {quantity > product.availableQty ? (
                <div className="mt-3 flex gap-2 rounded-lg bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-300">
                  <PackageCheck className="size-5 shrink-0" />
                  <span>
                    Only {product.availableQty} unit(s) are currently available. Checkout will recheck stock.
                  </span>
                </div>
              ) : null}
              <div className="mt-auto space-y-4 pt-6">
                <div className="flex items-end justify-between border-t pt-4">
                  <span className="text-muted-foreground">
                    Calculated total
                  </span>
                  <strong className="text-2xl">
                    {formatCurrency(total, product.currency)}
                  </strong>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  className="w-full"
                  disabled={product.price === null || product.availableQty < 1}
                  onClick={() => { onAddToCart(quantity); onClose(); }}
                >
                  <ShoppingCart className="mr-2 size-4" /> Add to cart
                </Button>
              </div>
            </div>
        </div>
      </section>
    </div>
  );
}

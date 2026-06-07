"use client";

import Image from "next/image";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { CheckCircle2, PackageCheck, ShoppingCart, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createCustomerOrder, type CustomerOrder } from "@/lib/api";
import { formatCurrency, type UserCatalogProduct } from "@/lib/userCatalog";

type Props = {
  product: UserCatalogProduct;
  customerToken: string;
  onClose: () => void;
};

export function OrderDialog({ product, customerToken, onClose }: Props) {
  const [quantity, setQuantity] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [order, setOrder] = useState<CustomerOrder | null>(null);
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

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (product.price === null)
      return setError(
        "A price must be configured before this product can be ordered.",
      );
    try {
      setSubmitting(true);
      setError(null);
      setOrder(
        await createCustomerOrder(customerToken, {
          productId: product.id,
          quantity,
        }),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to place order");
    } finally {
      setSubmitting(false);
    }
  };

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
          {order ? (
            <div className="flex h-full flex-col justify-center space-y-5">
              <CheckCircle2 className="size-12 text-emerald-500" />
              <div>
                <p className="text-sm font-medium text-emerald-600">
                  Order placed
                </p>
                <h2 id="order-title" className="text-3xl font-semibold">
                  Thank you for your order
                </h2>
              </div>
              <div className="bg-muted/50 space-y-2 rounded-xl p-4 text-sm">
                <p>
                  <strong>Order:</strong> {order.id}
                </p>
                <p>
                  <strong>Quantity:</strong> {order.quantity}
                </p>
                <p>
                  <strong>Total:</strong>{" "}
                  {formatCurrency(order.totalPrice, order.currency)}
                </p>
                {order.shortageQty > 0 ? (
                  <p className="text-amber-600">
                    <strong>{order.shortageQty} unit(s)</strong> were
                    unavailable and an inventory reorder was created
                    automatically.
                  </p>
                ) : (
                  <p className="text-emerald-600">
                    All requested units were allocated from inventory.
                  </p>
                )}
              </div>
              <Button onClick={onClose}>Continue shopping</Button>
            </div>
          ) : (
            <form onSubmit={submit} className="flex h-full flex-col">
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
                    {quantity - product.availableQty} additional unit(s) will be
                    reordered automatically.
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
                {error ? (
                  <p className="text-destructive text-sm">{error}</p>
                ) : null}
                <Button
                  type="submit"
                  size="lg"
                  className="w-full"
                  disabled={submitting || product.price === null}
                >
                  {submitting ? "Placing order…" : "Place secured order"}
                </Button>
              </div>
            </form>
          )}
        </div>
      </section>
    </div>
  );
}

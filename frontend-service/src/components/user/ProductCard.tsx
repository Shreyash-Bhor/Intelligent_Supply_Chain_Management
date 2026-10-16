import Image from "next/image";
import { Eye, ShoppingCart, ShoppingBag } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCurrency, type UserCatalogProduct } from "@/lib/userCatalog";

type Props = { product: UserCatalogProduct; onQuickView: () => void; onAdd: () => void };

export function ProductCard({ product, onQuickView, onAdd }: Props) {
  return (
    <Card className="group flex h-full flex-col overflow-hidden border-border/70 bg-card py-0 shadow-sm transition-shadow hover:shadow-md">
      <button type="button" onClick={onQuickView} className="focus-visible:ring-ring relative block aspect-[4/3] w-full overflow-hidden bg-muted/40 focus-visible:ring-2 focus-visible:outline-none" aria-label={`View ${product.name} details`}>
        {product.imageUrl ? <Image src={product.imageUrl} alt={product.name} fill className="object-contain p-5 transition-transform duration-200 group-hover:scale-[1.03]" sizes="(max-width: 640px) 90vw, (max-width: 1024px) 45vw, 30vw" /> : <span className="text-muted-foreground flex h-full items-center justify-center"><ShoppingBag className="size-10" aria-hidden="true" /></span>}
      </button>
      <CardContent className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex-1">
          <p className="text-muted-foreground text-xs">{product.category} · SKU {product.sku}</p>
          <button type="button" onClick={onQuickView} className="mt-1 text-left font-medium leading-snug hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2">{product.name}</button>
          <p className="mt-2 text-lg font-semibold">{formatCurrency(product.price, product.currency)}</p>
          <p className={`mt-1 text-xs ${product.availableQty ? "text-emerald-700 dark:text-emerald-400" : "text-muted-foreground"}`}>
            {product.availableQty ? `${product.availableQty} available` : "Currently unavailable"}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onQuickView}><Eye className="size-4" aria-hidden="true" /> Quick view</Button>
          <Button type="button" size="sm" onClick={onAdd} disabled={product.price === null || product.availableQty < 1}><ShoppingCart className="size-4" aria-hidden="true" /> Add to cart</Button>
        </div>
      </CardContent>
    </Card>
  );
}

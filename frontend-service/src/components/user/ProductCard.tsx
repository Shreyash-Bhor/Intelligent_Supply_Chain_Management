import Image from "next/image";
import { BadgeDollarSign, FileText, ShoppingBag } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/userCatalog";

type ProductCardProps = {
  name: string;
  description: string;
  price: number | null;
  currency: string;
  imageUrl?: string | null;
  availableQty: number;
  onClick: () => void;
};

export function ProductCard({
  name,
  description,
  price,
  currency,
  imageUrl,
  availableQty,
  onClick,
}: ProductCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-left"
      aria-label={`Order ${name}`}
    >
      <Card className="group h-full overflow-hidden border-border/70 bg-gradient-to-br from-background to-muted/30 py-0 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg">
        <div className="bg-muted/20 relative aspect-square w-full overflow-hidden">
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt={name}
              fill
              className="object-cover transition-transform duration-500 group-hover:scale-105"
              sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 20vw"
            />
          ) : (
            <div className="text-muted-foreground flex h-full flex-col items-center justify-center gap-2 text-sm">
              <ShoppingBag className="size-6" />
              <span>No image available</span>
            </div>
          )}
        </div>
        <CardContent className="space-y-3 p-4">
          <h3 className="line-clamp-2 text-base font-semibold">{name}</h3>
          <p className="text-muted-foreground line-clamp-2 flex items-start gap-2 text-sm">
            <FileText className="mt-0.5 size-4 shrink-0" />
            <span>{description}</span>
          </p>
          <div className="flex items-center justify-between gap-2">
            <div className="text-primary flex items-center gap-2 text-sm font-medium">
              <BadgeDollarSign className="size-4" />
              <span>{formatCurrency(price, currency)}</span>
            </div>
            <span className="text-muted-foreground text-xs">
              {availableQty} in stock
            </span>
          </div>
        </CardContent>
      </Card>
    </button>
  );
}

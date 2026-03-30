import Image from "next/image";
import { Card, CardContent } from "@/components/ui/card";

type ProductCardProps = {
  name: string;
  imageUrl?: string | null;
};

export function ProductCard({ name, imageUrl }: ProductCardProps) {
  return (
    <Card className="overflow-hidden border-border/70">
      <div className="bg-muted/20 relative aspect-square w-full">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={name}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 20vw"
          />
        ) : (
          <div className="text-muted-foreground flex h-full items-center justify-center text-sm">
            No image available
          </div>
        )}
      </div>
      <CardContent className="p-4">
        <h3 className="line-clamp-2 text-sm font-medium">{name}</h3>
      </CardContent>
    </Card>
  );
}

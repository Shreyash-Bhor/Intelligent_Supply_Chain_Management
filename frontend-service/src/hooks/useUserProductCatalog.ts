"use client";

import { useEffect, useState } from "react";
import {
  fetchProductPrice,
  type UserInventoryProduct,
  type ProductPrice,
} from "@/lib/api";
import {
  buildProductDescription,
  type UserCatalogProduct,
} from "@/lib/userCatalog";

type UseUserProductCatalogResult = {
  products: UserCatalogProduct[];
  loadingPrices: boolean;
};

function toCatalogProduct(
  product: UserInventoryProduct,
  price: ProductPrice | null,
): UserCatalogProduct {
  return {
    ...product,
    description: buildProductDescription(product),
    price: price?.price ?? null,
    currency: price?.currency ?? "USD",
  };
}

export function useUserProductCatalog(
  products: UserInventoryProduct[],
): UseUserProductCatalogResult {
  const [priceByProduct, setPriceByProduct] = useState<
    Map<string, ProductPrice | null>
  >(new Map());
  const [loadingPrices, setLoadingPrices] = useState(false);

  useEffect(() => {
    if (!products.length) {
      return;
    }

    let isMounted = true;

    const loadPricing = async () => {
      setLoadingPrices(true);

      const priceResults = await Promise.all(
        products.map(async (product) => {
          try {
            const price = await fetchProductPrice(product.id);
            return [product.id, price] as const;
          } catch {
            return [product.id, null] as const;
          }
        }),
      );

      if (!isMounted) {
        return;
      }

      setPriceByProduct(new Map<string, ProductPrice | null>(priceResults));
      setLoadingPrices(false);
    };

    void loadPricing();

    return () => {
      isMounted = false;
    };
  }, [products]);

  return {
    products: products.map((product) =>
      toCatalogProduct(product, priceByProduct.get(product.id) ?? null),
    ),
    loadingPrices,
  };
}

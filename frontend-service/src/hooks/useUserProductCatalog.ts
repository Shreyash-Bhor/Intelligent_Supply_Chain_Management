"use client";

import { useEffect, useState } from "react";
import {
  fetchProductPrices,
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
  price: Pick<ProductPrice, "price" | "currency"> | null,
): UserCatalogProduct {
  return {
    ...product,
    description: buildProductDescription(product),
    price: price?.price ?? null,
    currency: price?.currency ?? "INR",
  };
}

export function useUserProductCatalog(
  products: UserInventoryProduct[],
): UseUserProductCatalogResult {
  const [priceByProduct, setPriceByProduct] = useState<
    Map<string, Pick<ProductPrice, "price" | "currency"> | null>
  >(new Map());
  const [loadingPrices, setLoadingPrices] = useState(false);

  useEffect(() => {
    if (!products.length) {
      return;
    }

    let isMounted = true;

    const loadPricing = async () => {
      setLoadingPrices(true);

      let priceResults: Array<readonly [string, Pick<ProductPrice, "price" | "currency"> | null]> = [];
      try {
        const prices = await fetchProductPrices(products.map((product) => product.id));
        priceResults = prices.map((price) => [price.productId, price] as const);
      } catch {
        priceResults = products.map((product) => [product.id, null] as const);
      }

      if (!isMounted) {
        return;
      }

      setPriceByProduct(new Map<string, Pick<ProductPrice, "price" | "currency"> | null>(priceResults));
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

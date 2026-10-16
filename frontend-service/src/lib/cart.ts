import type { UserCatalogProduct } from "@/lib/userCatalog";
import { fetchCustomerCart, removeCustomerCartItem, setCustomerCartItem } from "@/lib/api";

export type CartLine = { product: UserCatalogProduct; quantity: number; unavailable?: boolean };
const CART_KEY = "supplySync-cart";
const CART_EVENT = "supplySync-cart-changed";
export const cartEventName = CART_EVENT;

function storageKey(userId?: string) { return `${CART_KEY}:${userId ?? "signed-in"}`; }
export function readCart(userId?: string): CartLine[] {
  if (typeof window === "undefined") return [];
  try { const value = JSON.parse(window.localStorage.getItem(storageKey(userId)) ?? "[]"); return Array.isArray(value) ? value : []; }
  catch { return []; }
}
function writeCart(cart: CartLine[], userId?: string) {
  window.localStorage.setItem(storageKey(userId), JSON.stringify(cart));
  window.dispatchEvent(new Event(CART_EVENT));
}
export function cacheServerCart(cart: Awaited<ReturnType<typeof fetchCustomerCart>>, userId?: string) {
  writeCart(cart.items.map((line) => {
    const product = line.product;
    return {
      product: {
        id: line.productId, name: product?.name ?? "Unavailable product", sku: product?.sku ?? "Unavailable", category: product?.category ?? "Unknown", createdAt: "",
        imageUrl: product?.imageUrl, availableQty: line.availableQty, description: product?.isActive ? "" : "This product is no longer available.",
        price: line.price === null ? null : Number(line.price), currency: line.currency ?? "INR",
      }, quantity: line.quantity, unavailable: line.unavailable,
    };
  }), userId);
}
export async function syncCart(token: string, userId?: string) {
  const cart = await fetchCustomerCart(token);
  cacheServerCart(cart, userId);
  return readCart(userId);
}
export async function addToCart(token: string, userId: string | undefined, product: UserCatalogProduct, quantity = 1) {
  const cart = await fetchCustomerCart(token);
  const existing = cart.items.find((line) => line.productId === product.id);
  const next = await setCustomerCartItem(token, product.id, (existing?.quantity ?? 0) + quantity);
  cacheServerCart(next, userId);
}
export async function updateCartQuantity(token: string, userId: string | undefined, productId: string, quantity: number) {
  const next = quantity > 0 ? await setCustomerCartItem(token, productId, quantity) : await removeCustomerCartItem(token, productId);
  cacheServerCart(next, userId);
}

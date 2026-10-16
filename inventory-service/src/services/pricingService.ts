type PriceResponse = {
  status: string;
  message?: string;
  data?: { price: number; currency: string };
};
type PricesResponse = {
  status: string;
  message?: string;
  data?: Array<{ productId: string; price: number; currency: string }>;
};

export async function getCurrentProductPrices(productIds: string[]) {
  if (!productIds.length) return new Map<string, { price: string; currency: string }>();
  const baseUrl = (process.env.PRICING_SERVICE_URL ?? "http://localhost:5555").replace(/\/$/, "");
  let response: Response;
  try {
    response = await fetch(`${baseUrl}/api/prices?productIds=${encodeURIComponent(productIds.join(","))}`, { signal: AbortSignal.timeout(5000) });
  } catch {
    throw Object.assign(new Error("Product pricing is temporarily unavailable"), { statusCode: 503 });
  }
  const payload = (await response.json()) as PricesResponse;
  if (!response.ok || payload.status !== "success" || !payload.data) {
    throw Object.assign(new Error(payload.message ?? "Product pricing is unavailable"), { statusCode: response.status >= 500 ? 503 : response.status });
  }
  return new Map(payload.data.map((item) => [item.productId, { price: item.price.toFixed(2), currency: item.currency }]));
}

export async function getCurrentProductPrice(productId: string) {
  const baseUrl = (
    process.env.PRICING_SERVICE_URL ?? "http://localhost:5555"
  ).replace(/\/$/, "");
  let response: Response;
  try {
    response = await fetch(`${baseUrl}/api/prices/${productId}`, { signal: AbortSignal.timeout(5000) });
  } catch {
    throw Object.assign(new Error("Product pricing is temporarily unavailable"), { statusCode: 503 });
  }
  const payload = (await response.json()) as PriceResponse;
  if (!response.ok || payload.status !== "success" || !payload.data) {
    throw Object.assign(new Error(payload.message ?? "Product pricing is unavailable"), { statusCode: response.status >= 500 ? 503 : response.status });
  }
  return payload.data;
}

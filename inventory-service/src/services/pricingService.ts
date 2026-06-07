type PriceResponse = {
  status: string;
  message?: string;
  data?: { price: number; currency: string };
};

export async function getCurrentProductPrice(productId: string) {
  const baseUrl = (
    process.env.PRICING_SERVICE_URL ?? "http://localhost:5555"
  ).replace(/\/$/, "");
  const response = await fetch(`${baseUrl}/api/prices/${productId}`);
  const payload = (await response.json()) as PriceResponse;
  if (!response.ok || payload.status !== "success" || !payload.data) {
    throw new Error(payload.message ?? "Product pricing is unavailable");
  }
  return payload.data;
}

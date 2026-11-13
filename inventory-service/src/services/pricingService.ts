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

const timeoutMs = Number(process.env.PRICING_SERVICE_TIMEOUT_MS ?? 8000);
const retryDelayMs = 150;

function isTransientStatus(status: number) {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

async function requestPricing(path: string): Promise<unknown> {
  const baseUrl = process.env.PRICING_SERVICE_URL;
  if (!baseUrl) {
    const error = new Error(
      "PRICING_SERVICE_URL is not configured on the inventory service",
    );
    console.error(
      JSON.stringify({
        event: "pricing_request_failed",
        service: "inventory",
        stage: "configuration",
        error: error.message,
        attempts: 0,
      }),
    );
    throw Object.assign(error, { statusCode: 503 });
  }
  const url = `${baseUrl.replace(/\/$/, "")}${path}`;
  const startedAt = Date.now();
  console.info(
    JSON.stringify({
      event: "pricing_request_started",
      service: "inventory",
      method: "GET",
      target: new URL(url).host,
      path: new URL(url).pathname,
      timeoutMs,
    }),
  );
  let lastError: unknown;

  // Pricing GETs are safe to retry once on transient transport/server failures.
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const response = await fetch(url, {
        headers: { Accept: "application/json", "Cache-Control": "no-cache" },
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (response.status === 304) {
        // This client sends no validators and keeps no representation cache, so
        // a 304 cannot be used as a successful pricing response.
        throw Object.assign(
          new Error("Product pricing is temporarily unavailable"),
          { statusCode: 304, noRetry: true },
        );
      }
      if (!response.ok) {
        const error = Object.assign(
          new Error(`Pricing service returned HTTP ${response.status}`),
          {
            statusCode: isTransientStatus(response.status)
              ? 503
              : response.status,
          },
        );
        if (isTransientStatus(response.status) && attempt < 2) {
          lastError = error;
          await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
          continue;
        }
        throw error;
      }
      const payload: unknown = await response.json();
      console.info(
        JSON.stringify({
          event: "pricing_request_complete",
          service: "inventory",
          status: response.status,
          attempt,
          durationMs: Date.now() - startedAt,
        }),
      );
      return payload;
    } catch (error) {
      lastError = error;
      const statusCode = (error as { statusCode?: number })?.statusCode;
      const noRetry = (error as { noRetry?: boolean })?.noRetry;
      const isTimeout =
        error instanceof Error &&
        (error.name === "TimeoutError" || error.name === "AbortError");
      const retryable =
        !noRetry &&
        (statusCode === 503 ||
          isTimeout ||
          !(error instanceof Error && "statusCode" in error));
      if (attempt < 2 && retryable) {
        await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
        continue;
      }
      console.warn(
        JSON.stringify({
          event: "pricing_request_failed",
          service: "inventory",
          statusCode: statusCode ?? null,
          errorType: isTimeout
            ? "timeout"
            : error instanceof Error
              ? error.name
              : "unknown",
          attempt,
          durationMs: Date.now() - startedAt,
        }),
      );
      const message =
        error instanceof Error
          ? error.message
          : "Unknown pricing service error";
      throw Object.assign(new Error(`Pricing request failed: ${message}`), {
        statusCode: 503,
        cause: error,
      });
    }
  }
  console.warn(
    JSON.stringify({
      event: "pricing_request_failed",
      service: "inventory",
      attempt: 2,
      durationMs: Date.now() - startedAt,
    }),
  );
  const message =
    lastError instanceof Error
      ? lastError.message
      : "Unknown pricing service error";
  throw Object.assign(
    new Error(`Pricing request failed after retries: ${message}`),
    { statusCode: 503, cause: lastError },
  );
}

export async function getCurrentProductPrices(productIds: string[]) {
  if (!productIds.length)
    return new Map<string, { price: string; currency: string }>();
  const payload = (await requestPricing(
    `/api/prices?productIds=${encodeURIComponent([...new Set(productIds)].join(","))}`,
  )) as PricesResponse;
  if (
    !payload ||
    payload.status !== "success" ||
    !Array.isArray(payload.data)
  ) {
    const message = "Pricing service returned an invalid response";
    console.error(
      JSON.stringify({
        event: "pricing_response_invalid",
        service: "inventory",
        reason: "missing_success_or_data_array",
      }),
    );
    throw Object.assign(new Error(message), { statusCode: 503 });
  }
  if (
    payload.data.some(
      (item) =>
        !item ||
        typeof item.productId !== "string" ||
        typeof item.price !== "number" ||
        !Number.isFinite(item.price) ||
        typeof item.currency !== "string",
    )
  ) {
    const message = "Pricing service returned an invalid price record";
    console.error(
      JSON.stringify({
        event: "pricing_response_invalid",
        service: "inventory",
        reason: "malformed_price_record",
      }),
    );
    throw Object.assign(new Error(message), { statusCode: 503 });
  }
  return new Map(
    payload.data.map((item) => [
      item.productId,
      { price: item.price.toFixed(2), currency: item.currency },
    ]),
  );
}

export async function getCurrentProductPrice(productId: string) {
  const payload = (await requestPricing(
    `/api/prices/${encodeURIComponent(productId)}`,
  )) as PriceResponse;
  if (!payload || payload.status !== "success" || !payload.data) {
    throw Object.assign(
      new Error(
        payload?.message ?? "Pricing service returned an invalid response",
      ),
      { statusCode: 503 },
    );
  }
  if (
    typeof payload.data.price !== "number" ||
    !Number.isFinite(payload.data.price) ||
    typeof payload.data.currency !== "string"
  ) {
    throw Object.assign(
      new Error("Pricing service returned an invalid price record"),
      { statusCode: 503 },
    );
  }
  return payload.data;
}

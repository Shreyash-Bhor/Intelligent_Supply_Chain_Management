export type PaymentResult = { reference: string; status: "PENDING" | "PAID" };

export interface PaymentProvider {
  initiate(input: { idempotencyKey: string; amount: string; currency: string }): Promise<PaymentResult>;
}

class DevelopmentMockPaymentProvider implements PaymentProvider {
  async initiate(input: { idempotencyKey: string; amount: string; currency: string }): Promise<PaymentResult> {
    if (!input.idempotencyKey || !input.amount || !input.currency) throw new Error("Invalid mock payment request");
    return { reference: `mock_${input.idempotencyKey}`, status: "PAID" };
  }
}

export function getPaymentProvider(): PaymentProvider {
  if (process.env.PAYMENT_PROVIDER === "mock" && process.env.NODE_ENV !== "production") return new DevelopmentMockPaymentProvider();
  throw Object.assign(new Error("A supported payment provider is not configured"), { statusCode: 503 });
}

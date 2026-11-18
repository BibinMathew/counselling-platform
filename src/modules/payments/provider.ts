import { z } from "zod";
import type { PaymentConfig } from "./config";
import {
  providerOrderSchema,
  providerPaymentSchema,
  type ProviderOrder,
  type ProviderPayment,
} from "./verification";

export interface PaymentProvider {
  createOrder(receipt: string, amount: number, currency: string): Promise<ProviderOrder>;
  getOrder(id: string): Promise<ProviderOrder>;
  findOrders(receipt: string): Promise<ProviderOrder[]>;
  getPayment(id: string): Promise<ProviderPayment>;
  getPayments(orderId: string): Promise<ProviderPayment[]>;
}
export class RazorpayProvider implements PaymentProvider {
  constructor(
    private readonly config: PaymentConfig,
    private readonly transport: typeof fetch = fetch,
  ) {}
  private async request(path: string, data?: unknown): Promise<unknown> {
    const response = await this.transport(`https://api.razorpay.com/v1/${path}`, {
      method: data === undefined ? "GET" : "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${this.config.keyId}:${this.config.keySecret}`).toString("base64")}`,
        "Content-Type": "application/json",
      },
      body: data === undefined ? undefined : JSON.stringify(data),
      signal: AbortSignal.timeout(10000),
      cache: "no-store",
    });
    if (!response.ok) throw new Error("Payment provider is unavailable");
    return response.json();
  }
  async createOrder(receipt: string, amount: number, currency: string) {
    return providerOrderSchema.parse(
      await this.request("orders", { amount, currency, receipt, partial_payment: false }),
    );
  }
  async getOrder(id: string) {
    return providerOrderSchema.parse(await this.request(`orders/${encodeURIComponent(id)}`));
  }
  async findOrders(receipt: string) {
    return z
      .object({ items: z.array(providerOrderSchema).max(100) })
      .parse(await this.request(`orders?receipt=${encodeURIComponent(receipt)}&count=100`)).items;
  }
  async getPayment(id: string) {
    return providerPaymentSchema.parse(await this.request(`payments/${encodeURIComponent(id)}`));
  }
  async getPayments(orderId: string) {
    return z
      .object({ items: z.array(providerPaymentSchema).max(100) })
      .parse(await this.request(`orders/${encodeURIComponent(orderId)}/payments`)).items;
  }
}

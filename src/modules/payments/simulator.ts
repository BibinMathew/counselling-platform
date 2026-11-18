import "server-only";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import type { PaymentProvider } from "./provider";
import { providerOrderSchema, providerPaymentSchema, type ProviderPayment } from "./verification";
import { z } from "zod";

const recordSchema = providerOrderSchema.extend({ payments: z.array(providerPaymentSchema) });
export class SimulatorProvider implements PaymentProvider {
  private db = createSupabaseServiceClient();
  async createOrder(receipt: string, amount: number, currency: string) {
    const result = await this.db
      .from("payment_simulator_orders")
      .upsert(
        { id: `sim_order_${receipt}`, receipt, amount, currency },
        { onConflict: "receipt", ignoreDuplicates: true },
      );
    if (result.error) throw new Error("Simulator provider unavailable");
    return this.getOrder(`sim_order_${receipt}`);
  }
  private async record(id: string) {
    const { data, error } = await this.db
      .from("payment_simulator_orders")
      .select("*")
      .eq("id", id)
      .single();
    if (error) throw new Error("Simulator provider order unavailable");
    return recordSchema.parse(data);
  }
  async getOrder(id: string) {
    return providerOrderSchema.parse(await this.record(id));
  }
  async findOrders(receipt: string) {
    const { data, error } = await this.db
      .from("payment_simulator_orders")
      .select("*")
      .eq("receipt", receipt);
    if (error) throw new Error("Simulator lookup unavailable");
    return z.array(providerOrderSchema).parse(data);
  }
  async getPayments(id: string) {
    return (await this.record(id)).payments;
  }
  async getPayment(id: string): Promise<ProviderPayment> {
    const { data, error } = await this.db
      .from("payment_simulator_orders")
      .select("*")
      .filter("payments", "cs", JSON.stringify([{ id }]))
      .single();
    if (error) throw new Error("Simulator payment unavailable");
    const result = recordSchema.parse(data).payments.find((p) => p.id === id);
    if (!result) throw new Error("Simulator payment unavailable");
    return result;
  }
}

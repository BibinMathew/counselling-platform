import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

export const providerOrderSchema = z.object({
  id: z.string().min(1),
  receipt: z.string(),
  amount: z.number().int().positive(),
  currency: z.string(),
  status: z.string(),
});
export const providerPaymentSchema = z.object({
  id: z.string().min(1),
  order_id: z.string().min(1),
  amount: z.number().int().positive(),
  currency: z.string(),
  status: z.string(),
});
export type ProviderOrder = z.infer<typeof providerOrderSchema>;
export type ProviderPayment = z.infer<typeof providerPaymentSchema>;

export function verifySignature(body: string, signature: string, secret: string): boolean {
  if (!secret || !/^[a-f0-9]{64}$/i.test(signature)) return false;
  return timingSafeEqual(
    createHmac("sha256", secret).update(body).digest(),
    Buffer.from(signature, "hex"),
  );
}

export function assertCapturedPayment(
  order: ProviderOrder,
  payment: ProviderPayment,
  expected: { id: string; receipt: string; amount: number; currency: string },
): void {
  if (
    order.id !== expected.id ||
    order.receipt !== expected.receipt ||
    payment.order_id !== order.id ||
    order.amount !== expected.amount ||
    payment.amount !== expected.amount ||
    order.currency !== expected.currency ||
    payment.currency !== expected.currency ||
    order.status !== "paid" ||
    payment.status !== "captured"
  )
    throw new Error("Payment verification mismatch");
}

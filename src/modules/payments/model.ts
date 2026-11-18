import { z } from "zod";
export const paymentOrderSchema = z.object({
  id: z.string().uuid(),
  booking_id: z.string().uuid(),
  customer_id: z.string().uuid(),
  provider: z.enum(["simulator", "razorpay"]),
  amount_paise: z.number().int().positive(),
  currency: z.literal("INR"),
  external_order_id: z.string().nullable(),
  creation_state: z.enum(["reserved", "creating", "ready", "uncertain"]),
  confirmed_payment_id: z.string().nullable(),
  review_reason: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  reconciled_at: z.string().nullable(),
});
export type PaymentOrder = z.infer<typeof paymentOrderSchema>;
export type CheckoutDetails = {
  id: string;
  provider: "simulator" | "razorpay";
  externalOrderId: string;
  amount: number;
  currency: string;
  keyId: string;
};
export function formatPrice(amount: number, currency = "INR") {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amount / 100);
}

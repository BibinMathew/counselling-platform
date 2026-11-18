import "server-only";
import { createHash, createHmac, randomUUID } from "node:crypto";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { readPaymentConfig } from "./config";
import { paymentOrderSchema, type PaymentOrder, type CheckoutDetails } from "./model";
import { RazorpayProvider } from "./provider";
import { SimulatorProvider } from "./simulator";
import { assertCapturedPayment, providerPaymentSchema, verifySignature } from "./verification";

const digest = (body: string) => createHash("sha256").update(body).digest("hex");
const config = () => readPaymentConfig(process.env);
function provider() {
  const c = config();
  if (c.mode === "disabled") throw new Error("Payments are not configured");
  return c.mode === "simulator" ? new SimulatorProvider() : new RazorpayProvider(c);
}
async function rpc(name: string, args: Record<string, unknown>) {
  const { data, error } = await createSupabaseServiceClient().rpc(name, args);
  if (error) throw new Error("Payment operation could not be completed");
  return data;
}
export async function getOwnedPayment(id: string, customerId: string) {
  const { data, error } = await createSupabaseServiceClient()
    .from("payment_orders")
    .select("*")
    .eq("id", z.string().uuid().parse(id))
    .eq("customer_id", customerId)
    .single();
  if (error) throw new Error("Payment not found");
  const order = paymentOrderSchema.parse(data);
  if (order.provider !== config().mode)
    throw new Error("Order belongs to a different payment mode");
  return order;
}
async function noteProblem(order: PaymentOrder, reason: string) {
  await rpc("note_payment_order_problem", { p_order_id: order.id, p_reason: reason });
}
async function ensureProviderOrder(order: PaymentOrder, create: boolean): Promise<PaymentOrder> {
  if (order.external_order_id) return order;
  const p = provider();
  const claimed = create && (await rpc("claim_payment_order", { p_order_id: order.id }));
  let external;
  if (claimed) {
    try {
      external = await p.createOrder(order.id, order.amount_paise, order.currency);
    } catch {
      await noteProblem(order, "creation_uncertain");
      throw new Error("Order creation is uncertain. Recheck payment before trying again.");
    }
  } else {
    if (order.creation_state === "reserved") throw new Error("Checkout has not started");
    if (
      order.creation_state === "creating" &&
      Date.now() - new Date(order.updated_at).getTime() < 30000
    )
      throw new Error("Checkout is being prepared. Recheck shortly.");
    const matches = await p.findOrders(order.id);
    if (matches.length !== 1) {
      await noteProblem(
        order,
        matches.length > 1 ? "multiple_provider_orders" : "creation_uncertain",
      );
      throw new Error("Order creation needs reconciliation; no new payment order was created.");
    }
    external = matches[0];
  }
  if (
    external.receipt !== order.id ||
    external.amount !== order.amount_paise ||
    external.currency !== order.currency
  ) {
    await noteProblem(order, "provider_mismatch");
    throw new Error("Payment order needs admin review");
  }
  await rpc("attach_payment_order", { p_order_id: order.id, p_external_id: external.id });
  return { ...order, external_order_id: external.id, creation_state: "ready", review_reason: null };
}
export async function startCheckout(
  bookingId: string,
  customerId: string,
): Promise<CheckoutDetails> {
  const c = config();
  if (c.mode === "disabled") throw new Error("Payments are not configured");
  const db = (await createSupabaseServerClient()) as unknown as SupabaseClient;
  const { data, error } = await db.rpc("reserve_payment_order", {
    p_booking_id: z.string().uuid().parse(bookingId),
    p_provider: c.mode,
  });
  if (error) throw new Error("This hold cannot start checkout. Refresh your bookings.");
  const reserved = paymentOrderSchema.parse(data);
  if (reserved.customer_id !== customerId) throw new Error("Payment ownership mismatch");
  const order = await ensureProviderOrder(reserved, true);
  return {
    id: order.id,
    provider: order.provider,
    externalOrderId: order.external_order_id!,
    amount: order.amount_paise,
    currency: order.currency,
    keyId: c.keyId,
  };
}
async function observe(
  order: PaymentOrder,
  paymentId: string,
  eventId: string,
  bodyDigest: string,
): Promise<string> {
  if (order.provider !== config().mode || !order.external_order_id)
    throw new Error("Payment mode mismatch");
  const p = provider();
  const [external, payment] = await Promise.all([
    p.getOrder(order.external_order_id),
    p.getPayment(paymentId),
  ]);
  if (
    external.id !== order.external_order_id ||
    external.receipt !== order.id ||
    payment.id !== paymentId ||
    payment.order_id !== order.external_order_id ||
    external.amount !== order.amount_paise ||
    external.currency !== order.currency
  ) {
    await noteProblem(order, "provider_mismatch");
    throw new Error("Payment identity mismatch; admin review required");
  }
  if (!["captured", "failed", "authorized"].includes(payment.status)) return "pending";
  if (
    payment.status === "captured" &&
    payment.amount === order.amount_paise &&
    payment.currency === order.currency
  ) {
    assertCapturedPayment(external, payment, {
      id: order.external_order_id,
      receipt: order.id,
      amount: order.amount_paise,
      currency: order.currency,
    });
  }
  return rpc("apply_payment_observation", {
    p_order_id: order.id,
    p_event_id: eventId,
    p_digest: bodyDigest,
    p_payment_id: payment.id,
    p_state: payment.status,
    p_amount: payment.amount,
    p_currency: payment.currency,
  });
}
export async function verifyCheckout(
  id: string,
  customerId: string,
  paymentId: string,
  signature: string,
) {
  const order = await getOwnedPayment(id, customerId);
  if (
    !order.external_order_id ||
    !verifySignature(`${order.external_order_id}|${paymentId}`, signature, config().keySecret)
  )
    throw new Error("Invalid payment signature");
  return observe(
    order,
    paymentId,
    `callback:${paymentId}`,
    digest(`${order.external_order_id}|${paymentId}|${signature}`),
  );
}
export async function processPaymentWebhook(body: string, signature: string, eventId: string) {
  const c = config();
  if (c.mode === "disabled" || !verifySignature(body, signature, c.webhookSecret))
    throw new Error("Invalid webhook signature");
  if (!eventId || eventId.length > 150) throw new Error("Invalid webhook event ID");
  const event = z.object({ event: z.string(), payload: z.unknown() }).parse(JSON.parse(body));
  if (
    !["payment.captured", "payment.failed", "payment.authorized", "order.paid"].includes(
      event.event,
    )
  )
    return "ignored";
  const payload = z
    .object({ payment: z.object({ entity: providerPaymentSchema }) })
    .parse(event.payload);
  const payment = payload.payment.entity;
  const { data, error } = await createSupabaseServiceClient()
    .from("payment_orders")
    .select("*")
    .eq("provider", c.mode)
    .eq("external_order_id", payment.order_id)
    .maybeSingle();
  if (error) throw new Error("Webhook lookup failed");
  if (!data) {
    await rpc("record_unmatched_payment_event", {
      p_provider: c.mode,
      p_event_id: `webhook:${eventId}`,
      p_digest: digest(body),
    });
    return "unmatched_order";
  }
  return observe(paymentOrderSchema.parse(data), payment.id, `webhook:${eventId}`, digest(body));
}
export async function recheckPayment(order: PaymentOrder, claim = true) {
  if (claim && !(await rpc("claim_payment_refresh", { p_order_id: order.id })))
    throw new Error("Payment was checked recently. Try again shortly.");
  order = await ensureProviderOrder(order, false);
  const payments = await provider().getPayments(order.external_order_id!);
  let result = order.confirmed_payment_id ? "confirmed" : "pending";
  // Process unsuccessful attempts first. An older failed attempt must not hide capture.
  for (const payment of [...payments].sort(
    (a, b) => Number(a.status === "captured") - Number(b.status === "captured"),
  )) {
    const observation = await observe(
      order,
      payment.id,
      `reconcile:${payment.id}:${payment.status}`,
      digest(JSON.stringify(payment)),
    );
    if (result !== "admin_review" && (result !== "confirmed" || observation === "admin_review"))
      result = observation;
  }
  return result;
}
export async function reconcilePayments() {
  const c = config();
  if (c.mode === "disabled") throw new Error("Payments are not configured");
  const orders = z
    .array(paymentOrderSchema)
    .parse(await rpc("claim_payment_reconciliation", { p_limit: 20, p_provider: c.mode }));
  let failed = 0;
  for (const order of orders) {
    try {
      await recheckPayment(order, false);
    } catch {
      failed++;
    }
  }
  return { checked: orders.length, failed };
}
export async function simulatePayment(
  id: string,
  customerId: string,
  result: "captured" | "failed" | "authorized",
  deliver: boolean,
) {
  if (config().mode !== "simulator") throw new Error("Simulator unavailable");
  const order = await getOwnedPayment(id, customerId);
  const payment = providerPaymentSchema.parse(
    await rpc("simulate_payment_attempt", { p_order_id: order.id, p_result: result }),
  );
  if (!deliver) return "Recheck payment to recover the captured payment.";
  const body = JSON.stringify({
    event: `payment.${payment.status}`,
    payload: { payment: { entity: payment } },
  });
  const signature = createHmac("sha256", config().webhookSecret).update(body).digest("hex");
  return processPaymentWebhook(body, signature, `sim_${randomUUID()}`);
}
export async function getPaymentPrice() {
  const db = (await createSupabaseServerClient()) as unknown as SupabaseClient;
  const { data, error } = await db
    .from("payment_settings")
    .select("amount_paise,currency")
    .single();
  if (error) throw new Error("Session price unavailable");
  return z
    .object({ amount_paise: z.number().int().positive(), currency: z.literal("INR") })
    .parse(data);
}

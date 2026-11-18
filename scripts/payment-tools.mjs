import { createHmac, randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
const [command, id] = process.argv.slice(2);
const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
const app = process.env.LOCAL_APP_URL ?? "http://127.0.0.1:3000";
if (
  !base ||
  !["127.0.0.1", "localhost"].includes(new URL(base).hostname) ||
  !["127.0.0.1", "localhost"].includes(new URL(app).hostname) ||
  process.env.PAYMENT_MODE !== "simulator"
)
  throw new Error("Payment tools require local simulator mode and localhost services");
const db = createClient(base, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
if (command === "reconcile") {
  const response = await fetch(app + "/api/payments/reconcile", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.PAYMENT_RECONCILE_SECRET}` },
  });
  if (!response.ok) throw new Error(`Reconciliation HTTP ${response.status}`);
  console.log(await response.json());
} else {
  if (!/^[0-9a-f-]{36}$/i.test(id ?? ""))
    throw new Error(
      "Usage: payment-tools.mjs reconcile | capture ORDER_ID | expire ORDER_ID | replay ORDER_ID",
    );
  const order = await db
    .from("payment_orders")
    .select("id,booking_id,external_order_id")
    .eq("id", id)
    .eq("provider", "simulator")
    .single();
  if (order.error) throw new Error("Local simulated order not found");
  if (command === "capture") {
    const result = await db.rpc("simulate_payment_attempt", {
      p_order_id: id,
      p_result: "captured",
    });
    if (result.error) throw new Error("Simulator capture failed");
    console.log(
      "Captured at simulator only. Use replay or customer Recheck payment to deliver it.",
    );
  } else if (command === "expire") {
    const result = await db
      .from("bookings")
      .update({ hold_expires_at: new Date(Date.now() - 1000).toISOString() })
      .eq("id", order.data.booking_id)
      .eq("status", "held")
      .select("id");
    if (result.error || !result.data.length)
      throw new Error("Only an existing held simulator booking can expire");
    console.log("Local simulated hold expired; payment state was preserved.");
  } else if (command === "replay") {
    const simulation = await db
      .from("payment_simulator_orders")
      .select("payments")
      .eq("receipt", id)
      .single();
    const payment =
      simulation.data?.payments?.findLast((p) => p.status === "captured") ??
      simulation.data?.payments?.at(-1);
    if (!payment) throw new Error("No simulated provider payment to replay");
    const body = JSON.stringify({
      event: `payment.${payment.status}`,
      payload: { payment: { entity: payment } },
    });
    const signature = createHmac("sha256", process.env.PAYMENT_SIMULATOR_SECRET)
      .update(body)
      .digest("hex");
    const event = process.env.PAYMENT_REPLAY_EVENT_ID ?? `local_${randomUUID()}`;
    const response = await fetch(app + "/api/payments/webhook", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-razorpay-signature": signature,
        "x-razorpay-event-id": event,
      },
      body,
    });
    if (!response.ok) throw new Error(`Replay HTTP ${response.status}`);
    console.log(await response.json());
  } else throw new Error("Unknown command");
}

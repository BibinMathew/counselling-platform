import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireProfileRole } from "@/modules/identity/server/access";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AdminPaymentControls } from "@/modules/payments/components/admin-payments";
import { getPaymentPrice } from "@/modules/payments/server";
import { formatPrice, paymentOrderSchema } from "@/modules/payments/model";
import { z } from "zod";
export default function PaymentsPage() {
  return (
    <div className="page-main catalog-page">
      <Link href="/admin">Admin area</Link>
      <h1>Payments</h1>
      <Suspense fallback={<p>Loading payments...</p>}>
        <Content />
      </Suspense>
    </div>
  );
}
async function Content() {
  await connection();
  await requireProfileRole("admin");
  const db = (await createSupabaseServerClient()) as unknown as SupabaseClient;
  const [price, result] = await Promise.all([
    getPaymentPrice(),
    db.from("payment_orders").select("*").order("created_at", { ascending: false }).limit(100),
  ]);
  if (result.error) throw new Error("Payments unavailable");
  const orders = z.array(paymentOrderSchema).parse(result.data);
  const [exceptionsResult, unmatchedResult] = await Promise.all([
    db.rpc("get_payment_exceptions"),
    db.rpc("get_unmatched_payment_events"),
  ]);
  if (exceptionsResult.error || unmatchedResult.error)
    throw new Error("Payment exceptions unavailable");
  const exceptions = z.array(paymentOrderSchema).parse(exceptionsResult.data);
  const unmatched = z
    .array(
      z.object({
        provider: z.string(),
        event_id: z.string(),
        outcome: z.string(),
        created_at: z.string(),
      }),
    )
    .parse(unmatchedResult.data);
  return (
    <>
      <AdminPaymentControls amount={price.amount_paise} />
      <p>
        Showing the latest 100 checkout orders. Reconciliation checks up to 20 eligible orders per
        run; recently checked orders are skipped for one minute.
      </p>
      <p>
        Captured payments with conflicts require manual investigation. No automatic refunds are
        issued.
      </p>
      <h2>Unresolved exceptions</h2>
      <p>Oldest 100 unresolved exceptions, including orders outside the latest-order list.</p>
      {!exceptions.length && <p>No payment exceptions.</p>}
      {exceptions.map((order) => (
        <p key={order.id}>
          <span className="payment-reference">{order.id}</span>:{" "}
          {order.review_reason?.replaceAll("_", " ")}
        </p>
      ))}
      {!!unmatched.length && (
        <>
          <h2>Unmatched provider events</h2>
          <p>
            Latest 100 events with no linked checkout order. Investigate these gateway references
            before taking action.
          </p>
          {unmatched.map((event) => (
            <p key={event.event_id} className="payment-reference">
              {event.provider}: {event.event_id}
            </p>
          ))}
        </>
      )}
      <h2>Recent checkout orders</h2>
      {!orders.length && <p>No checkout orders yet.</p>}
      <div className="booking-list">
        {orders.map((order) => (
          <article key={order.id} className="booking-entry">
            <h2>{formatPrice(order.amount_paise)}</h2>
            <p>
              Booking: <span className="payment-reference">{order.booking_id}</span>
            </p>
            <p>
              Order: <span className="payment-reference">{order.id}</span>
            </p>
            <p>
              {order.provider} ·{" "}
              {order.confirmed_payment_id ? "Payment confirmed" : order.creation_state}
            </p>
            {order.review_reason && (
              <p role="alert">Admin review: {order.review_reason.replaceAll("_", " ")}</p>
            )}
          </article>
        ))}
      </div>
    </>
  );
}

import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { getMyBookings } from "@/modules/booking/server/bookings";
import { BookingPayment } from "@/modules/payments/components/checkout";
import { getPaymentPrice } from "@/modules/payments/server";
import { readPaymentConfig } from "@/modules/payments/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { paymentOrderSchema } from "@/modules/payments/model";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

export default function BookingsPage() {
  return (
    <main className="catalog-page booking-page">
      <Link href="/customer">Customer area</Link>
      <h1>Your bookings</h1>
      <Suspense fallback={<p>Loading bookings...</p>}>
        <BookingsContent />
      </Suspense>
    </main>
  );
}

async function BookingsContent() {
  await connection();
  const bookings = await getMyBookings();
  const client = (await createSupabaseServerClient()) as unknown as SupabaseClient;
  const [price, ordersResult, transactionsResult] = await Promise.all([
    getPaymentPrice(),
    client.from("payment_orders").select("*"),
    client
      .from("payment_transactions")
      .select("order_id,outcome,updated_at")
      .order("updated_at", { ascending: false }),
  ]);
  if (ordersResult.error || transactionsResult.error)
    throw new Error("Payment information unavailable");
  const orders = z.array(paymentOrderSchema).parse(ordersResult.data);
  const transactions = z
    .array(
      z.object({
        order_id: z.string().uuid(),
        outcome: z.enum(["pending", "failed", "confirmed", "admin_review"]),
        updated_at: z.string(),
      }),
    )
    .parse(transactionsResult.data);
  const enabled = readPaymentConfig(process.env).mode !== "disabled";
  const formatter = new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  });
  return (
    <>
      {!bookings.length && <p>You have no holds or appointments.</p>}
      <div className="booking-list">
        {bookings.map((booking) => {
          const order = orders.find((o) => o.booking_id === booking.id);
          return (
            <article key={booking.id} className="booking-entry">
              <h2>{booking.counselor_name}</h2>
              <p>
                <time dateTime={booking.start_at}>
                  {formatter.format(new Date(booking.start_at))}
                </time>{" "}
                · Asia/Kolkata
              </p>
              {booking.status === "held" && (
                <p>
                  Held until{" "}
                  <time dateTime={booking.hold_expires_at}>
                    {formatter.format(new Date(booking.hold_expires_at))}
                  </time>
                  . This is not a confirmed appointment until payment is verified.
                </p>
              )}
              {booking.status === "expired" && <p>Hold expired</p>}
              <BookingPayment
                bookingId={booking.id}
                amount={order?.amount_paise ?? price.amount_paise}
                orderId={order?.id}
                reviewReason={order?.review_reason}
                paymentState={
                  order?.confirmed_payment_id
                    ? "confirmed"
                    : transactions.find((t) => t.order_id === order?.id)?.outcome
                }
                canPay={booking.status === "held"}
                enabled={enabled}
              />
              {booking.status === "confirmed" && (
                <>
                  <p>Confirmed</p>
                  {booking.canReschedule && (
                    <Link
                      href={`/counselors/${booking.counselor_id}?${new URLSearchParams({ reschedule: booking.id })}`}
                    >
                      Reschedule
                    </Link>
                  )}
                </>
              )}
            </article>
          );
        })}
      </div>
    </>
  );
}

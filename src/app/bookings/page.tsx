import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { getMyBookings } from "@/modules/booking/server/bookings";

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
  const formatter = new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  });
  return (
    <>
      {!bookings.length && <p>You have no holds or appointments.</p>}
      <div className="booking-list">
        {bookings.map((booking) => (
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
                . Payment is not available; this is not a confirmed appointment.
              </p>
            )}
            {booking.status === "expired" && <p>Hold expired</p>}
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
        ))}
      </div>
    </>
  );
}

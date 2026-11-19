import Link from "next/link";
import { BookingPayment } from "@/modules/payments/components/checkout";
import { formatPrice } from "@/modules/payments/model";
import { readPaymentConfig } from "@/modules/payments/config";
import { getPaymentPrice } from "@/modules/payments/server";
import { bookAgainHref, portalViews, type PortalQueryInput, type PortalBooking } from "../model";
import { getCustomerPortal } from "../server";
const labels = { all: "All", upcoming: "Upcoming", past: "Past", holds: "Holds" };
const format = (value: string) =>
  new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(new Date(value));
export async function CustomerPortal({ query }: { query: PortalQueryInput }) {
  const result = await getCustomerPortal(query);
  const price = await getPaymentPrice();
  const enabled = readPaymentConfig(process.env).mode !== "disabled";
  const url = (page: number) => `/bookings?view=${result.view}&page=${page}`;
  const empty = {
    all: "You have no holds or appointments.",
    upcoming: "No upcoming appointments.",
    past: "No past appointments.",
    holds: "No holds or expired checkouts.",
  };
  return (
    <>
      {result.booking &&
        result.items.some((b) => b.id === result.booking && b.status === "confirmed") && (
          <p role="status">Appointment confirmed. Your booking is shown below.</p>
        )}
      <nav className="portal-filters" aria-label="Appointment views">
        {portalViews.map((view) => (
          <Link
            key={view}
            href={`/bookings?view=${view}`}
            aria-current={result.view === view ? "page" : undefined}
          >
            {labels[view]}
          </Link>
        ))}
      </nav>
      <p>
        <Link href="/counselors">Find a counselor</Link> for a new appointment. You can choose any
        counselor.
      </p>
      <p>Page {result.page + 1} · Times shown in Asia/Kolkata</p>
      {!result.items.length && <p>{empty[result.view]}</p>}
      <div className="booking-list">
        {result.items.map((booking) => (
          <AppointmentCard
            key={booking.id}
            booking={booking}
            enabled={enabled}
            currentPrice={price.amount_paise}
            confirmedHref={result.view === "holds" ? `/bookings?booking=${booking.id}` : undefined}
          />
        ))}
      </div>
      <nav className="portal-pagination" aria-label="Appointment pages">
        {result.page > 0 && <Link href={url(result.page - 1)}>Previous page</Link>}
        {result.has_more && <Link href={url(result.page + 1)}>Next page</Link>}
      </nav>
    </>
  );
}
function AppointmentCard({
  booking,
  enabled,
  currentPrice,
  confirmedHref,
}: {
  booking: PortalBooking;
  enabled: boolean;
  currentPrice: number;
  confirmedHref?: string;
}) {
  return (
    <article className="booking-entry" data-booking-id={booking.id}>
      <h2>{booking.counselor_name}</h2>
      <p>
        <time dateTime={booking.start_at}>{format(booking.start_at)}</time>
        {" – "}
        <time dateTime={booking.end_at}>
          {new Intl.DateTimeFormat("en-IN", {
            timeStyle: "short",
            timeZone: "Asia/Kolkata",
          }).format(new Date(booking.end_at))}
        </time>{" "}
        · Asia/Kolkata
      </p>
      {booking.in_progress && <p>In progress</p>}
      {booking.is_past && <p>Past appointment</p>}
      {booking.status === "held" && (
        <p>
          Held until{" "}
          <time dateTime={booking.hold_expires_at}>{format(booking.hold_expires_at)}</time>. This is
          not a confirmed appointment until payment is verified.
        </p>
      )}
      {booking.status === "expired" && <p>Hold expired</p>}
      {booking.amount_paise !== null && <p>Payment total: {formatPrice(booking.amount_paise)}</p>}
      <BookingPayment
        bookingId={booking.id}
        amount={booking.amount_paise ?? currentPrice}
        orderId={booking.order_id ?? undefined}
        canPay={booking.status === "held"}
        enabled={enabled && !booking.is_past}
        reviewReason={booking.review_reason}
        paymentState={booking.payment_state ?? undefined}
        confirmedHref={confirmedHref}
      />
      {booking.status === "confirmed" && (
        <>
          <p>Confirmed</p>
          {!booking.is_past &&
            (booking.meeting_url ? (
              <a
                href={booking.meeting_url}
                target="_blank"
                rel="noopener noreferrer"
                referrerPolicy="no-referrer"
              >
                Join Meet
              </a>
            ) : (
              <p>Meeting link will follow.</p>
            ))}
          {booking.can_reschedule && booking.counselor_bookable && (
            <p>
              <Link
                href={`/counselors/${booking.counselor_id}?${new URLSearchParams({ reschedule: booking.id })}`}
              >
                Reschedule
              </Link>
            </p>
          )}
          {booking.is_past &&
            (booking.counselor_bookable ? (
              <p>
                <Link href={bookAgainHref(booking)}>Book Again</Link>
              </p>
            ) : (
              <p>
                This counselor is currently unavailable.{" "}
                <Link href="/counselors">Browse counselors</Link>
              </p>
            ))}
        </>
      )}
    </article>
  );
}

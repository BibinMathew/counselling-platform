import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { readFeedbackAdminMode } from "@/lib/local-features";
import { requireProfileRole } from "@/modules/identity/server/access";
import { getAdminBookings } from "@/modules/admin-operations/server";
import {
  Filters,
  Pages,
  FilterForm,
  LocalNotice,
  Disabled,
  OperationsShell,
  formatTime,
} from "@/modules/admin-operations/components";
import type { QueryInput } from "@/modules/admin-operations/model";
export default function Page({ searchParams }: { searchParams: Promise<QueryInput> }) {
  return (
    <OperationsShell>
      <Suspense fallback={<p>Loading bookings…</p>}>
        <Content searchParams={searchParams} />
      </Suspense>
    </OperationsShell>
  );
}
async function Content({ searchParams }: { searchParams: Promise<QueryInput> }) {
  await connection();
  await requireProfileRole("admin");
  if (readFeedbackAdminMode(process.env) === "disabled") return <Disabled />;
  const input = await searchParams;
  const data = await getAdminBookings(input);
  return (
    <>
      <h1>Booking oversight</h1>
      <LocalNotice />
      <Filters
        base="/admin/bookings"
        views={["all", "upcoming", "past", "holds", "expired"]}
        current={data.view}
        input={input}
      />
      <FilterForm booking view={data.view} />
      <p>
        As of {formatTime(data.as_of)}. Past appointments retain their actual status; attendance is
        not recorded.
      </p>
      {!data.items.length && <p>No bookings match this view.</p>}
      <div className="booking-list">
        {data.items.map((b) => (
          <article className="booking-entry" data-booking-id={b.id} key={b.id}>
            <h2>{b.counselor_name}</h2>
            <p>
              {formatTime(b.start_at)} – {formatTime(b.end_at)}
            </p>
            <p>
              Status: {b.status} · Reschedules: {b.reschedule_count}
            </p>
            <p className="payment-reference">Booking {b.id}</p>
            <p className="payment-reference">Customer {b.customer_id}</p>
            <p>
              <Link href={`/admin/exceptions?source=booking&id=${b.id}`}>
                Open operational case
              </Link>
            </p>
            <p>
              <Link href="/admin/appointments">Appointments and meeting links</Link>
              {" · "}
              <Link href="/admin/payments">Payments</Link>
              {" · "}
              <Link href="/admin/notifications">Notifications</Link>
            </p>
          </article>
        ))}
      </div>
      <Pages base="/admin/bookings" page={data.page} hasMore={data.has_more} input={input} />
    </>
  );
}

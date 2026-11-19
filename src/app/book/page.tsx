import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { getPublicAvailability } from "@/modules/availability/server/availability";
import { BookingForm } from "@/modules/booking/components/booking-form";
import { safeBookingReturn } from "@/modules/booking/return-path";
import { getMyBookings } from "@/modules/booking/server/bookings";
import { getPublicCounselor } from "@/modules/catalog/server/catalog";
import { getCurrentProfile } from "@/modules/identity/server/access";

type Selection = { counselor?: string; start?: string; reschedule?: string };

export default function BookPage({ searchParams }: { searchParams: Promise<Selection> }) {
  return (
    <main className="catalog-page booking-page">
      <Link href="/counselors">All counselors</Link>
      <Suspense fallback={<p>Loading selected time...</p>}>
        <BookingContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function BookingContent({ searchParams }: { searchParams: Promise<Selection> }) {
  await connection();
  const selected = await searchParams;
  const query = new URLSearchParams({
    counselor: selected.counselor ?? "",
    start: selected.start ?? "",
  });
  if (selected.reschedule) query.set("reschedule", selected.reschedule);
  const next = safeBookingReturn(`/book?${query}`);
  if (!next || !selected.counselor || !selected.start) notFound();
  const profile = await getCurrentProfile();
  if (!profile) redirect(`/login?${new URLSearchParams({ next })}`);
  if (!profile.email) redirect(`/complete-profile?${new URLSearchParams({ next })}`);
  if (profile.role !== "customer") redirect("/unauthorized");
  const [counselor, slots, bookings] = await Promise.all([
    getPublicCounselor(selected.counselor),
    getPublicAvailability(selected.counselor),
    getMyBookings(),
  ]);
  if (!counselor) notFound();
  const selectedTime = new Date(selected.start).getTime();
  const slot = slots.find((entry) => new Date(entry.start_at).getTime() === selectedTime);
  const priorHold = bookings.find(
    (entry) =>
      entry.counselor_id === selected.counselor &&
      new Date(entry.start_at).getTime() === selectedTime &&
      entry.status === "held",
  );
  const original = selected.reschedule
    ? bookings.find(
        (entry) =>
          entry.id === selected.reschedule &&
          entry.counselor_id === selected.counselor &&
          entry.status === "confirmed" &&
          entry.reschedule_count === 0,
      )
    : undefined;
  if (selected.reschedule && !original) notFound();
  const displayTime = new Intl.DateTimeFormat("en-IN", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(new Date(selected.start));
  return (
    <>
      <h1>{selected.reschedule ? "Reschedule appointment" : "Selected time"}</h1>
      <p>{counselor.display_name}</p>
      <p>
        <time dateTime={selected.start}>{displayTime}</time> · Asia/Kolkata
      </p>
      {priorHold && !selected.reschedule ? (
        <p>
          This time is already held for you. <Link href="/bookings">View your holds</Link>
        </p>
      ) : slot ? (
        <>
          <BookingForm
            counselor={selected.counselor}
            start={selected.start}
            reschedule={selected.reschedule}
          />
          {!selected.reschedule && (
            <p>A hold reserves your time temporarily. Confirmation requires verified payment.</p>
          )}
        </>
      ) : (
        <p>
          This time is no longer available.{" "}
          <Link href={`/counselors/${selected.counselor}`}>Choose another time</Link>
        </p>
      )}
    </>
  );
}

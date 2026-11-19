import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { getAdminAppointments, formatAppointmentTime } from "@/modules/meetings/server";
import { MeetingForm } from "@/modules/meetings/components/meeting-form";
export default function AppointmentsPage() {
  return (
    <main className="catalog-page booking-page operations-page">
      <Link href="/admin">Admin area</Link>
      <h1>Appointments and meeting links</h1>
      <Suspense fallback={<p>Loading appointments…</p>}>
        <Content />
      </Suspense>
    </main>
  );
}
async function Content() {
  await connection();
  const rows = await getAdminAppointments();
  const missing = rows.filter((r) => !r.meeting_url);
  return (
    <>
      <h2>Missing meeting links ({missing.length})</h2>
      <p>
        Future confirmed appointments remain here until a meeting link is attached. Create a unique
        Google Meet link manually, then save it below.
      </p>
      {!rows.length && <p>No upcoming confirmed appointments.</p>}
      <div className="booking-list">
        {[...missing, ...rows.filter((r) => r.meeting_url)].map((row) => (
          <article className="booking-entry" key={row.id}>
            <h2>{row.counselor_name}</h2>
            <p>{formatAppointmentTime(row.start_at)} · Asia/Kolkata</p>
            <p>Appointment {row.id}</p>
            {!row.meeting_url && <p>Meeting link will follow.</p>}
            <MeetingForm bookingId={row.id} url={row.meeting_url} />
          </article>
        ))}
      </div>
    </>
  );
}

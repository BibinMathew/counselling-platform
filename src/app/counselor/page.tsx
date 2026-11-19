import { getAssignedAppointments, formatAppointmentTime } from "@/modules/meetings/server";
import { Suspense } from "react";
import { connection } from "next/server";
import { requireProfileRole } from "@/modules/identity/server/access";

export default function CounselorPlaceholderPage() {
  return (
    <main>
      <Suspense fallback={<p>Loading account...</p>}>
        <CounselorContent />
      </Suspense>
    </main>
  );
}

async function CounselorContent() {
  await connection();
  const profile = await requireProfileRole("counselor");
  const appointments = await getAssignedAppointments();

  return (
    <>
      <h1>Counselor area</h1>
      <p>Signed in as {profile.preferred_name || profile.phone}.</p>
      <p>
        <a href="/counselor/availability">Manage availability</a>
      </p>
      <p>Credential review is required before providing sessions.</p>
      <h2>Upcoming appointments</h2>
      {!appointments.length && <p>No upcoming confirmed appointments.</p>}
      {appointments.map((a) => (
        <article key={a.id}>
          <p>{formatAppointmentTime(a.start_at)} · Asia/Kolkata</p>
          {a.meeting_url ? (
            <a
              href={a.meeting_url}
              target="_blank"
              rel="noopener noreferrer"
              referrerPolicy="no-referrer"
            >
              Join Meet
            </a>
          ) : (
            <p>Meeting link will follow.</p>
          )}
        </article>
      ))}
      <a href="/profile">Profile</a>
    </>
  );
}

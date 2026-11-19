import { DateTile, StatusBadge, PageIntro } from "@/components/ui";
import { getAssignedAppointments, formatAppointmentTime } from "@/modules/meetings/server";
import Link from "next/link";
import { readWorkspaceMode } from "@/lib/private-content/config";
import { getWorkspace } from "@/modules/counselor-workspace/server";
import { sessionTime, type WorkspaceQuery } from "@/modules/counselor-workspace/model";
import { Suspense } from "react";
import { connection } from "next/server";
import { requireProfileRole } from "@/modules/identity/server/access";

export default function CounselorPlaceholderPage({
  searchParams,
}: {
  searchParams: Promise<WorkspaceQuery>;
}) {
  return (
    <div className="page-main catalog-page booking-page">
      <Suspense fallback={<p>Loading account...</p>}>
        <CounselorContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function CounselorContent({ searchParams }: { searchParams: Promise<WorkspaceQuery> }) {
  await connection();
  const profile = await requireProfileRole("counselor");
  if (readWorkspaceMode(process.env) !== "disabled") {
    const workspace = await getWorkspace(await searchParams);
    return (
      <>
        <PageIntro eyebrow="Counselor workspace" title="Counselor area">
          Your assigned sessions and availability.
        </PageIntro>
        <p>Local synthetic workspace. Do not enter real counseling information.</p>
        <p>
          <Link href="/counselor/availability">Manage availability</Link>
          {" · "}
          <Link href="/profile">Profile</Link>
        </p>
        <nav className="portal-filters" aria-label="Session views">
          <Link
            href="/counselor?view=upcoming"
            aria-current={workspace.view === "upcoming" ? "page" : undefined}
          >
            Upcoming
          </Link>
          <Link
            href="/counselor?view=past"
            aria-current={workspace.view === "past" ? "page" : undefined}
          >
            Past
          </Link>
        </nav>
        <h2>{workspace.view === "past" ? "Past appointments" : "Upcoming appointments"}</h2>
        <p>Page {workspace.page + 1} · Asia/Kolkata</p>
        {!workspace.items.length && (
          <p>No {workspace.view === "past" ? "past" : "upcoming"} confirmed appointments.</p>
        )}
        <div className="booking-list">
          {workspace.items.map((s) => (
            <article className="booking-entry" key={s.id} data-booking-id={s.id}>
              <div className="appointment-heading">
                <DateTile value={s.start_at} />
                <div>
                  <h3>{s.customer_name}</h3>
                  <StatusBadge status="confirmed">Confirmed</StatusBadge>
                </div>
              </div>
              <p>{sessionTime(s.start_at)} · Asia/Kolkata</p>
              <p>
                {s.is_past
                  ? "Past appointment"
                  : s.in_progress
                    ? "In progress"
                    : "Upcoming appointment"}
              </p>
              <p>
                <Link href={`/counselor/appointments/${s.id}`}>Open appointment</Link>
              </p>
              {!s.is_past &&
                (s.meeting_url ? (
                  <a
                    href={s.meeting_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    referrerPolicy="no-referrer"
                  >
                    Join Meet
                  </a>
                ) : (
                  <p>Meeting link will follow.</p>
                ))}
            </article>
          ))}
        </div>
        <nav className="portal-pagination" aria-label="Session pages">
          {workspace.page > 0 && (
            <Link href={`?view=${workspace.view}&page=${workspace.page - 1}`}>Previous page</Link>
          )}
          {workspace.has_more && (
            <Link href={`?view=${workspace.view}&page=${workspace.page + 1}`}>Next page</Link>
          )}
        </nav>
      </>
    );
  }
  const appointments = await getAssignedAppointments();

  return (
    <>
      <PageIntro eyebrow="Counselor workspace" title="Counselor area">
        Your assigned sessions and availability.
      </PageIntro>
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

import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { getAdminNotifications } from "@/modules/notifications/server";
import { NotificationControl } from "@/modules/notifications/components/admin-notifications";
import { formatAppointmentTime } from "@/modules/meetings/server";
export default function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; status?: string }>;
}) {
  return (
    <div className="page-main catalog-page booking-page operations-page">
      <Link href="/admin">Admin area</Link>
      <h1>Notifications</h1>
      <Suspense fallback={<p>Loading notifications…</p>}>
        <Content searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
async function Content({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; status?: string }>;
}) {
  await connection();
  const { mode, jobs, receipts, page, failedOnly, hasNext } = await getAdminNotifications(
    await searchParams,
  );
  if (mode === "disabled")
    return (
      <p>
        Notification delivery is paused. Enable the local simulator to inspect synthetic delivery.
      </p>
    );
  return (
    <>
      <p>
        Local simulator. No email or WhatsApp message is sent. Showing jobs in pages of 100;
        delivered means simulated delivery.
      </p>
      <nav aria-label="Notification queue">
        <Link href="/admin/notifications">All jobs</Link>
        {" · "}
        <Link href="/admin/notifications?status=failed">Failed jobs</Link>
      </nav>
      <p>
        Page {page + 1}
        {failedOnly ? " · Failed jobs" : ""}
      </p>
      <NotificationControl operation="run" label="Run notification batch" />
      {!jobs.length && <p>No notification jobs.</p>}
      <nav aria-label="Notification pages">
        {page > 0 && (
          <Link href={`?page=${page - 1}${failedOnly ? "&status=failed" : ""}`}>Newer jobs</Link>
        )}{" "}
        {hasNext && (
          <Link href={`?page=${page + 1}${failedOnly ? "&status=failed" : ""}`}>Older jobs</Link>
        )}
      </nav>
      <div className="booking-list">
        {jobs.map((job) => {
          const receipt = receipts.find((r) => r.job_id === job.id);
          return (
            <article className="booking-entry" key={job.id}>
              <h2>{job.template.replaceAll("_", " ")}</h2>
              <p>Appointment {job.booking_id}</p>
              <p>
                {job.channel} · {job.status} · Attempts {job.attempts}
              </p>
              <p>Due {formatAppointmentTime(job.due_at)} · Asia/Kolkata</p>
              {job.error_code && <p>{job.error_code.replaceAll("_", " ")}</p>}
              {["failed", "retrying"].includes(job.status) && (
                <NotificationControl jobId={job.id} operation="retry" label="Retry notification" />
              )}
              {["queued", "retrying"].includes(job.status) && (
                <NotificationControl jobId={job.id} operation="fail" label="Fail next attempt" />
              )}
              {receipt && (
                <details>
                  <summary>Synthetic preview</summary>
                  <p>{receipt.subject}</p>
                  <p>{receipt.body}</p>
                  <p>Simulated destination: {receipt.destination}</p>
                </details>
              )}
            </article>
          );
        })}
      </div>
    </>
  );
}

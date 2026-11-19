import Link from "next/link";
import { getOverview } from "./server";
import { formatTime } from "./components";
export async function OperationalOverview() {
  const d = await getOverview();
  const counts: [string, number, string][] = [
    ["Upcoming/current confirmed", d.upcoming, "/admin/bookings?view=upcoming"],
    ["Today's confirmed appointments", d.today, "/admin/bookings"],
    ["Future confirmed missing Meet", d.missing_meet, "/admin/appointments"],
    ["Payment orders requiring review", d.payment_review, "/admin/payments"],
    ["Unmatched payment events", d.unmatched, "/admin/payments"],
    ["Failed notification jobs", d.failed_notifications, "/admin/notifications?status=failed"],
    ["Unreviewed feedback", d.unreviewed, "/admin/feedback?view=unreviewed"],
    ["Active operational cases", d.active_cases, "/admin/exceptions"],
  ];
  return (
    <section>
      <h2>Operational overview</h2>
      <p>
        Synthetic test features · As of {formatTime(d.as_of)} · Asia/Kolkata. Counts cover all
        eligible records and do not certify attendance.
      </p>
      <div className="metric-grid">
        {counts.map(([label, count, href]) => (
          <article className="metric-card" key={label}>
            <h3>
              <Link href={href}>{label}</Link>
            </h3>
            <p>{count}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

import { PageIntro } from "@/components/ui";
import Link from "next/link";
import { readFeedbackAdminMode } from "@/lib/local-features";
import { OperationalOverview } from "@/modules/admin-operations/overview";
import { Suspense } from "react";
import { connection } from "next/server";
import { RoleAssignmentForm } from "@/modules/identity/components/role-assignment-form";
import { requireProfileRole } from "@/modules/identity/server/access";

export default function AdminPlaceholderPage() {
  return (
    <div className="page-main">
      <Suspense fallback={<p>Loading account...</p>}>
        <AdminContent />
      </Suspense>
    </div>
  );
}

async function AdminContent() {
  await connection();
  const profile = await requireProfileRole("admin");

  return (
    <>
      <PageIntro eyebrow="Administration" title="Admin area">
        Manage bookings, counselor availability and platform operations.
      </PageIntro>
      <p>Signed in as {profile.preferred_name || profile.phone}.</p>
      <div className="workspace-shortcuts">
        <Link href="/admin/counselors">Manage counselors</Link>
        <Link href="/admin/availability">Scheduling settings</Link>
        <Link href="/admin/appointments">Appointments and meeting links</Link>
        <Link href="/admin/notifications">Notifications</Link>
        <Link href="/admin/payments">Payments and pricing</Link>
      </div>
      {readFeedbackAdminMode(process.env) !== "disabled" && (
        <>
          <p>
            <Link href="/admin/bookings">Booking oversight</Link>
            {" · "}
            <Link href="/admin/feedback">Private feedback</Link>
            {" · "}
            <Link href="/admin/exceptions">Operational exceptions</Link>
          </p>
          <OperationalOverview />
        </>
      )}
      <h2>Assign account role</h2>
      <RoleAssignmentForm />
      <Link href="/profile">Profile</Link>
    </>
  );
}

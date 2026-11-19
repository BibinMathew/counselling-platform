import { PageIntro } from "@/components/ui";
import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { requireProfileRole } from "@/modules/identity/server/access";

export default function CustomerPlaceholderPage() {
  return (
    <div className="page-main">
      <Suspense fallback={<p>Loading account...</p>}>
        <CustomerContent />
      </Suspense>
    </div>
  );
}

async function CustomerContent() {
  await connection();
  const profile = await requireProfileRole("customer");

  return (
    <>
      <PageIntro eyebrow="Your workspace" title="Customer area">
        Your sessions, booking history and account details in one place.
      </PageIntro>
      <p>Signed in as {profile.preferred_name || profile.phone}.</p>
      <div className="workspace-shortcuts">
        <Link href="/bookings">Your bookings and appointment history</Link>
        <Link href="/profile">Profile</Link>
      </div>
      <p>
        <Link href="/counselors">Find a counselor</Link> for a new appointment. You can choose any
        counselor.
      </p>
    </>
  );
}

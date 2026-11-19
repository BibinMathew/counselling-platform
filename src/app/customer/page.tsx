import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { requireProfileRole } from "@/modules/identity/server/access";

export default function CustomerPlaceholderPage() {
  return (
    <main>
      <Suspense fallback={<p>Loading account...</p>}>
        <CustomerContent />
      </Suspense>
    </main>
  );
}

async function CustomerContent() {
  await connection();
  const profile = await requireProfileRole("customer");

  return (
    <>
      <h1>Customer area</h1>
      <p>Signed in as {profile.preferred_name || profile.phone}.</p>
      <p>
        <a href="/bookings">Your bookings and appointment history</a>
      </p>
      <p>
        <Link href="/counselors">Find a counselor</Link> for a new appointment. You can choose any
        counselor.
      </p>
      <a href="/profile">Profile</a>
    </>
  );
}

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

  return (
    <>
      <h1>Counselor area</h1>
      <p>Signed in as {profile.preferred_name || profile.phone}.</p>
      <p>
        <a href="/counselor/availability">Manage availability</a>
      </p>
      <p>Credential review is required before providing sessions.</p>
      <a href="/profile">Profile</a>
    </>
  );
}

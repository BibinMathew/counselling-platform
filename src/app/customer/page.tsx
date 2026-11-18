import { Suspense } from "react";
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
      <a href="/profile">Profile</a>
    </>
  );
}

import { Suspense } from "react";
import { connection } from "next/server";
import { RoleAssignmentForm } from "@/modules/identity/components/role-assignment-form";
import { requireProfileRole } from "@/modules/identity/server/access";

export default function AdminPlaceholderPage() {
  return (
    <main>
      <Suspense fallback={<p>Loading account...</p>}>
        <AdminContent />
      </Suspense>
    </main>
  );
}

async function AdminContent() {
  await connection();
  const profile = await requireProfileRole("admin");

  return (
    <>
      <h1>Admin area</h1>
      <p>Signed in as {profile.preferred_name || profile.phone}.</p>
      <h2>Assign account role</h2>
      <RoleAssignmentForm />
      <a href="/profile">Profile</a>
    </>
  );
}

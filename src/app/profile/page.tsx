import { Suspense } from "react";
import { connection } from "next/server";
import { ProfileForm } from "@/modules/identity/components/profile-form";
import { signOut } from "@/modules/identity/actions";
import { requireProfile } from "@/modules/identity/server/access";

export default function ProfilePage() {
  return (
    <main>
      <Suspense fallback={<p>Loading account...</p>}>
        <ProfileContent />
      </Suspense>
    </main>
  );
}

async function ProfileContent() {
  await connection();
  const profile = await requireProfile();

  return (
    <>
      <h1>Your profile</h1>
      <p>Preferred name: {profile.preferred_name || "Not set"}</p>
      <p>Contact email: {profile.email}</p>
      <p>Role: {profile.role}</p>
      <ProfileForm preferredName={profile.preferred_name ?? ""} />
      <form action={signOut}>
        <button type="submit">Sign out</button>
      </form>
    </>
  );
}

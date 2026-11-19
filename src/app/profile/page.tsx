import { Suspense } from "react";
import { connection } from "next/server";
import { ProfileForm } from "@/modules/identity/components/profile-form";
import { requireProfile } from "@/modules/identity/server/access";

export default function ProfilePage() {
  return (
    <div className="page-main auth-page">
      <Suspense fallback={<p>Loading account...</p>}>
        <ProfileContent />
      </Suspense>
    </div>
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
    </>
  );
}

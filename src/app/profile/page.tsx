import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { ProfileForm } from "@/modules/identity/components/profile-form";
import { requireProfile } from "@/modules/identity/server/access";

export default function ProfilePage() {
  return (
    <div className="page-main profile-page">
      <Suspense fallback={<p>Loading account...</p>}>
        <ProfileContent />
      </Suspense>
    </div>
  );
}

async function ProfileContent() {
  await connection();
  const profile = await requireProfile();
  const joined = new Intl.DateTimeFormat("en-IN", {
    dateStyle: "long",
    timeZone: "Asia/Kolkata",
  }).format(new Date(profile.created_at));

  return (
    <>
      <header className="profile-intro">
        <p className="profile-eyebrow">Your account</p>
        <h1>Your profile</h1>
        <p>Manage how you are known and review your account details.</p>
      </header>
      <section className="profile-panel" aria-labelledby="profile-name-heading">
        <h2 id="profile-name-heading">Your preferred name</h2>
        <p>Choose the name you would like to use. A pseudonym is welcome.</p>
        <ProfileForm preferredName={profile.preferred_name ?? ""} />
      </section>
      <section className="profile-panel" aria-labelledby="profile-details-heading">
        <h2 id="profile-details-heading">Account details</h2>
        <dl className="profile-details">
          <div>
            <dt>Mobile number</dt>
            <dd>{profile.phone}</dd>
            <dd className="profile-detail-note">Used to sign in with a one-time code.</dd>
          </div>
          <div>
            <dt>Contact email</dt>
            <dd>{profile.email}</dd>
            <dd className="profile-detail-note">Email address not verified.</dd>
          </div>
          <div>
            <dt>Account created</dt>
            <dd>
              <time dateTime={profile.created_at}>{joined}</time>
            </dd>
          </div>
          {profile.role !== "customer" && (
            <div>
              <dt>Account role</dt>
              <dd>{profile.role === "admin" ? "Administrator" : "Counselor"}</dd>
            </div>
          )}
        </dl>
        <p className="profile-detail-note">
          Mobile number and contact email cannot be changed here.
        </p>
      </section>
      {profile.role === "customer" && (
        <section
          className="profile-panel profile-bookings"
          aria-labelledby="profile-bookings-heading"
        >
          <div>
            <h2 id="profile-bookings-heading">Your appointments</h2>
            <p>View your bookings and appointment history.</p>
          </div>
          <Link className="button-primary" href="/bookings">
            View bookings
          </Link>
        </section>
      )}
    </>
  );
}

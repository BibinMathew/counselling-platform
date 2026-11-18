import { Suspense } from "react";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { ContactEmailForm } from "@/modules/identity/components/contact-email-form";
import { safeBookingReturn } from "@/modules/booking/return-path";
import { requireAuthenticatedProfile } from "@/modules/identity/server/access";

export default function CompleteProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  return (
    <main>
      <Suspense fallback={<p>Loading account...</p>}>
        <CompleteProfileContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function CompleteProfileContent({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  await connection();
  const profile = await requireAuthenticatedProfile();
  const next = safeBookingReturn((await searchParams).next);

  if (profile.email) {
    redirect(next ?? "/profile");
  }

  return (
    <>
      <h1>Add a contact email</h1>
      <p>Enter your email once to finish setting up your account.</p>
      <p>
        This address is not email-verified and is not used to sign in. Phone OTP remains your
        sign-in method.
      </p>
      <ContactEmailForm next={next} />
    </>
  );
}

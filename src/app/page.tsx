import Link from "next/link";
import { Suspense } from "react";
import { HomeAccount } from "@/modules/identity/components/home-account";

export default function Home() {
  return (
    <main className="catalog-page booking-page">
      <h1>Counseling Platform</h1>
      <p>Book a confidential one-to-one counseling session.</p>
      <p>
        <Link href="/counselors">Find a counselor</Link>
      </p>
      <Suspense fallback={<p>Loading account...</p>}>
        <HomeAccount />
      </Suspense>
    </main>
  );
}

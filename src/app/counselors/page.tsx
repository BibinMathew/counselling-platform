import Image from "next/image";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { getPublicSessionSettings } from "@/modules/availability/server/availability";
import { getPublicCounselors } from "@/modules/catalog/server/catalog";
import { getPaymentPrice } from "@/modules/payments/server";
import { formatPrice } from "@/modules/payments/model";

export default function CounselorsPage() {
  return (
    <main className="catalog-page">
      <Link href="/">Home</Link>
      <h1>Find a counselor</h1>
      <Suspense fallback={<p>Loading counselors...</p>}>
        <Directory />
      </Suspense>
    </main>
  );
}

async function Directory() {
  await connection();
  const [counselors, settings, price] = await Promise.all([
    getPublicCounselors(),
    getPublicSessionSettings(),
    getPaymentPrice(),
  ]);
  return (
    <>
      <p>
        One-to-one sessions · {settings.session_minutes} minutes · {formatPrice(price.amount_paise)}
      </p>
      {!counselors.length && <p>No counselor profiles are available yet.</p>}
      <div className="counselor-list">
        {counselors.map((counselor) => (
          <article className="counselor-card" key={counselor.id}>
            <Image
              className="counselor-photo"
              src={counselor.photo_url}
              alt={`Portrait of ${counselor.display_name}`}
              width={160}
              height={180}
              unoptimized
            />
            <div>
              <h2>
                <Link href={`/counselors/${counselor.id}`}>{counselor.display_name}</Link>
              </h2>
              <p>{counselor.qualifications}</p>
              <p>{counselor.experience}</p>
              <p>
                <strong>Specializations:</strong> {counselor.specialties}
              </p>
              <p>
                <strong>Languages:</strong> {counselor.languages}
              </p>
              <Link href={`/counselors/${counselor.id}`}>View profile</Link>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}

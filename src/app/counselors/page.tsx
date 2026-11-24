import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { getPublicSessionSettings } from "@/modules/availability/server/availability";
import { getPublicCounselors } from "@/modules/catalog/server/catalog";
import { CounselorCard } from "@/modules/catalog/components/counselor-card";
import { isCatalogDemoMode } from "@/modules/catalog/demo";
import { getPaymentPrice } from "@/modules/payments/server";
import { formatPrice } from "@/modules/payments/model";

export default function CounselorsPage() {
  return (
    <div className="page-main catalog-page">
      <Link href="/">Home</Link>
      <h1>Find a counselor</h1>
      <Suspense fallback={<p>Loading counselors...</p>}>
        <Directory />
      </Suspense>
    </div>
  );
}

async function Directory() {
  await connection();
  const counselors = await getPublicCounselors();
  const demoMode = isCatalogDemoMode();
  let sessionTerms: string | null = null;
  if (!demoMode) {
    const [settings, price] = await Promise.all([getPublicSessionSettings(), getPaymentPrice()]);
    sessionTerms = `One-to-one sessions · ${settings.session_minutes} minutes · ${formatPrice(price.amount_paise)}`;
  }
  return (
    <>
      {sessionTerms ? (
        <p>{sessionTerms}</p>
      ) : (
        <p className="catalog-demo-notice" role="note">
          UX preview only: these profiles are fictional and do not represent real therapists.
        </p>
      )}
      {!counselors.length && <p>No counselor profiles are available yet.</p>}
      <div className="counselor-list">
        {counselors.map((counselor) => (
          <CounselorCard counselor={counselor} key={counselor.id} />
        ))}
      </div>
    </>
  );
}

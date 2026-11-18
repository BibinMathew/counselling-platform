import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { CounselorForm } from "@/modules/catalog/components/counselor-form";
import { getAdminCounselors } from "@/modules/catalog/server/catalog";

export default function AdminCounselorsPage() {
  return (
    <main className="catalog-page">
      <Link href="/admin">Admin area</Link>
      <h1>Manage counselors</h1>
      <Suspense fallback={<p>Loading counselors...</p>}>
        <AdminCatalog />
      </Suspense>
    </main>
  );
}

async function AdminCatalog() {
  await connection();
  const counselors = await getAdminCounselors();
  return (
    <>
      <details>
        <summary>Add counselor</summary>
        <CounselorForm />
      </details>
      <h2>Counselor profiles</h2>
      {!counselors.length && <p>No counselor profiles yet.</p>}
      {counselors.map((counselor) => (
        <details key={counselor.id}>
          <summary>
            {counselor.display_name} ({counselor.published ? "Published" : "Draft"})
          </summary>
          <p>
            <Link href={`/admin/counselors/${counselor.id}/availability`}>Manage availability</Link>
          </p>
          <CounselorForm counselor={counselor} />
        </details>
      ))}
    </>
  );
}

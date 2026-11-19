import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { AvailabilityEditor } from "@/modules/availability/components/availability-editor";
import { getAvailabilityManagement } from "@/modules/availability/server/availability";
import { requireProfileRole } from "@/modules/identity/server/access";

export default function CounselorAvailabilityPage() {
  return (
    <div className="page-main catalog-page">
      <Link href="/counselor">Counselor area</Link>
      <h1>Your availability</h1>
      <Suspense fallback={<p>Loading availability...</p>}>
        <AvailabilityContent />
      </Suspense>
    </div>
  );
}

async function AvailabilityContent() {
  await connection();
  await requireProfileRole("counselor");
  const data = await getAvailabilityManagement();
  if (!data)
    return <p>Your counselor profile has not been set up yet. Contact an administrator.</p>;
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  return (
    <AvailabilityEditor
      counselorId={data.counselor.id}
      rules={data.rules}
      exceptions={data.exceptions}
      today={today}
    />
  );
}

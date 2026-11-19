import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { z } from "zod";
import { AvailabilityEditor } from "@/modules/availability/components/availability-editor";
import { getAvailabilityManagement } from "@/modules/availability/server/availability";
import { requireProfileRole } from "@/modules/identity/server/access";

export default function AdminCounselorAvailabilityPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <div className="page-main catalog-page">
      <Link href="/admin/counselors">Manage counselors</Link>
      <Suspense fallback={<p>Loading availability...</p>}>
        <AvailabilityContent params={params} />
      </Suspense>
    </div>
  );
}

async function AvailabilityContent({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  await requireProfileRole("admin");
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const data = await getAvailabilityManagement(id);
  if (!data) notFound();
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  return (
    <>
      <h1>{data.counselor.display_name}: availability</h1>
      <AvailabilityEditor
        counselorId={id}
        rules={data.rules}
        exceptions={data.exceptions}
        today={today}
      />
    </>
  );
}

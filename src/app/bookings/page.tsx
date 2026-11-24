import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { CustomerPortal } from "@/modules/customer-portal/components/portal";
import type { PortalQueryInput } from "@/modules/customer-portal/model";
export default function BookingsPage({
  searchParams,
}: {
  searchParams: Promise<PortalQueryInput>;
}) {
  return (
    <div className="page-main catalog-page booking-page customer-bookings-page">
      <Link href="/customer">Customer area</Link>
      <h1>Your bookings</h1>
      <Suspense fallback={<p>Loading bookings...</p>}>
        <Content searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
async function Content({ searchParams }: { searchParams: Promise<PortalQueryInput> }) {
  await connection();
  return <CustomerPortal query={await searchParams} />;
}

import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { z } from "zod";
import { readFeedbackAdminMode } from "@/lib/local-features";
import { requireProfileRole } from "@/modules/identity/server/access";
import { getFeedbackPage } from "@/modules/feedback/server";
import { FeedbackEditor } from "@/modules/feedback/editor";
import { formatTime, LocalNotice, Disabled } from "@/modules/admin-operations/components";
export default function FeedbackPage({ params }: { params: Promise<{ bookingId: string }> }) {
  return (
    <div className="page-main catalog-page booking-page">
      <Link href="/bookings?view=past">Your bookings</Link>
      <Suspense fallback={<p>Loading feedback…</p>}>
        <Content params={params} />
      </Suspense>
    </div>
  );
}
async function Content({ params }: { params: Promise<{ bookingId: string }> }) {
  await connection();
  await requireProfileRole("customer");
  if (readFeedbackAdminMode(process.env) === "disabled") return <Disabled />;
  const id = z
    .string()
    .uuid()
    .safeParse((await params).bookingId);
  if (!id.success) notFound();
  const data = await getFeedbackPage(id.data);
  if (!data) notFound();
  return (
    <>
      <h1>Private appointment feedback</h1>
      <LocalNotice />
      <h2>{data.counselor_name}</h2>
      <p>{formatTime(data.start_at)}</p>
      {data.receipt ? (
        <section>
          <h2>Your submitted feedback</h2>
          <p>{data.receipt.rating} out of 5 stars</p>
          {data.receipt.comment && <p className="private-copy">{data.receipt.comment}</p>}
          <p>Submitted {formatTime(data.receipt.created_at)}. This submission cannot be edited.</p>
        </section>
      ) : data.eligible ? (
        <FeedbackEditor bookingId={data.booking_id} />
      ) : (
        <p>Feedback opens after the confirmed appointment ends.</p>
      )}
    </>
  );
}

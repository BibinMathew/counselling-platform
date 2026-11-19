import { Suspense } from "react";
import { connection } from "next/server";
import { readFeedbackAdminMode } from "@/lib/local-features";
import { requireProfileRole } from "@/modules/identity/server/access";
import { getAdminFeedback } from "@/modules/feedback/server";
import { FeedbackReview } from "@/modules/feedback/editor";
import {
  Filters,
  Pages,
  FilterForm,
  LocalNotice,
  Disabled,
  OperationsShell,
  formatTime,
} from "@/modules/admin-operations/components";
import type { QueryInput } from "@/modules/admin-operations/model";
export default function Page({ searchParams }: { searchParams: Promise<QueryInput> }) {
  return (
    <OperationsShell>
      <Suspense fallback={<p>Loading feedback…</p>}>
        <Content searchParams={searchParams} />
      </Suspense>
    </OperationsShell>
  );
}
async function Content({ searchParams }: { searchParams: Promise<QueryInput> }) {
  await connection();
  await requireProfileRole("admin");
  if (readFeedbackAdminMode(process.env) === "disabled") return <Disabled />;
  const input = await searchParams;
  const data = await getAdminFeedback(input);
  return (
    <>
      <h1>Private feedback review</h1>
      <LocalNotice />
      <Filters
        base="/admin/feedback"
        views={["all", "unreviewed", "reviewed"]}
        current={data.view}
        input={input}
      />
      <FilterForm view={data.view} />
      <p>As of {formatTime(data.as_of)}. Feedback is private to admins and its author.</p>
      {!data.items.length && <p>No feedback matches this view.</p>}
      <div className="booking-list">
        {data.items.map((f) => (
          <article className="booking-entry" key={f.id}>
            <h2>
              {f.counselor_name} · {f.rating} out of 5 stars
            </h2>
            <p>{formatTime(f.start_at)}</p>
            <p className="payment-reference">Booking {f.booking_id}</p>
            <p>Submitted {formatTime(f.created_at)}</p>
            {f.comment && <p className="private-copy">{f.comment}</p>}
            {f.reviewed_at ? (
              <p>Reviewed {formatTime(f.reviewed_at)}</p>
            ) : (
              <FeedbackReview id={f.id} />
            )}
          </article>
        ))}
      </div>
      <Pages base="/admin/feedback" page={data.page} hasMore={data.has_more} input={input} />
    </>
  );
}

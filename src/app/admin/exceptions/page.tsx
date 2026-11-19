import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { readFeedbackAdminMode } from "@/lib/local-features";
import { requireProfileRole } from "@/modules/identity/server/access";
import { getCases } from "@/modules/admin-operations/server";
import { CaseOpenForm } from "@/modules/admin-operations/editor";
import {
  Filters,
  Pages,
  LocalNotice,
  Disabled,
  OperationsShell,
  formatTime,
  statusLabel,
} from "@/modules/admin-operations/components";
import type { QueryInput } from "@/modules/admin-operations/model";
export default function Page({ searchParams }: { searchParams: Promise<QueryInput> }) {
  return (
    <OperationsShell>
      <Suspense fallback={<p>Loading cases…</p>}>
        <Content searchParams={searchParams} />
      </Suspense>
    </OperationsShell>
  );
}
async function Content({ searchParams }: { searchParams: Promise<QueryInput> }) {
  await connection();
  await requireProfileRole("admin");
  if (readFeedbackAdminMode(process.env) !== "local") return <Disabled />;
  const input = await searchParams;
  const data = await getCases(input);
  return (
    <>
      <h1>Operational exceptions</h1>
      <LocalNotice />
      <p>
        Case follow-up is tracked separately from source issues. Closing a case does not clear
        payment evidence or change bookings.
      </p>
      <CaseOpenForm
        sourceType={typeof input.source === "string" ? input.source : undefined}
        sourceId={typeof input.id === "string" ? input.id : undefined}
      />
      <Filters
        base="/admin/exceptions"
        views={["all", "open", "in_progress", "closed"]}
        current={data.view}
      />
      {!data.items.length && <p>No cases match this view.</p>}
      <div className="booking-list">
        {data.items.map((c) => (
          <article className="booking-entry" key={c.id}>
            <h2>{c.source_type.replaceAll("_", " ")} follow-up</h2>
            <p>
              {statusLabel(c.status)} · Version {c.version} · {formatTime(c.updated_at)}
            </p>
            <p className="payment-reference">Source {c.source_id}</p>
            <Link href={`/admin/exceptions/${c.id}`}>View case</Link>
          </article>
        ))}
      </div>
      <Pages base="/admin/exceptions" page={data.page} hasMore={data.has_more} input={input} />
    </>
  );
}

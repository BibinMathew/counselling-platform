import Link from "next/link";
import { randomUUID } from "node:crypto";
import { Suspense } from "react";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { z } from "zod";
import { readFeedbackAdminMode } from "@/lib/local-features";
import { requireProfileRole } from "@/modules/identity/server/access";
import { getCaseDetail } from "@/modules/admin-operations/server";
import { CaseEditor } from "@/modules/admin-operations/editor";
import {
  Pages,
  LocalNotice,
  Disabled,
  OperationsShell,
  formatTime,
  statusLabel,
} from "@/modules/admin-operations/components";
import type { QueryInput } from "@/modules/admin-operations/model";
type Props = { params: Promise<{ caseId: string }>; searchParams: Promise<QueryInput> };
export default function Page(props: Props) {
  return (
    <OperationsShell>
      <Suspense fallback={<p>Loading case…</p>}>
        <Content {...props} />
      </Suspense>
    </OperationsShell>
  );
}
async function Content({ params, searchParams }: Props) {
  await connection();
  await requireProfileRole("admin");
  if (readFeedbackAdminMode(process.env) === "disabled") return <Disabled />;
  const id = z
    .string()
    .uuid()
    .safeParse((await params).caseId);
  if (!id.success) notFound();
  const input = await searchParams;
  const data = await getCaseDetail(id.data, input);
  if (!data) notFound();
  const c = data.case;
  return (
    <>
      <p>
        <Link href="/admin/exceptions">All cases</Link>
      </p>
      <h1>Operational case</h1>
      <LocalNotice />
      <p>
        Case status: {statusLabel(c.status)} · Version {c.version}
      </p>
      <p className="payment-reference">Case {c.id}</p>
      <p className="payment-reference">
        {c.source_type.replaceAll("_", " ")} source: {c.source_id}
      </p>
      {c.booking_id && (
        <p>
          <Link href={`/admin/bookings?booking=${c.booking_id}`}>View linked booking</Link>
        </p>
      )}
      <h2>Current source facts</h2>
      {data.source ? (
        <dl className="source-facts">
          {Object.entries(data.source).map(([k, v]) => (
            <div key={k}>
              <dt>{k.replaceAll("_", " ")}</dt>
              <dd className="payment-reference">
                {v === null
                  ? "Not present"
                  : k.endsWith("_at") && typeof v === "string"
                    ? formatTime(v)
                    : String(v)}
              </dd>
            </div>
          ))}
        </dl>
      ) : (
        <p>Source information is unavailable.</p>
      )}
      <p>
        Source facts and case status are independent. Administrative closure is not a financial
        remedy or proof of attendance.
      </p>
      <p>
        <Link href="/admin/payments">Payments</Link>
        {" · "}
        <Link href="/admin/notifications">Notifications</Link>
        {" · "}
        <Link href="/admin/appointments">Meeting links</Link>
      </p>
      <CaseEditor caseId={c.id} version={c.version} status={c.status} requestId={randomUUID()} />
      <h2>Case history</h2>
      {data.items.map((e) => (
        <article className="booking-entry" key={e.id}>
          <h3>
            Version {e.version} · {e.action}
          </h3>
          <p>{formatTime(e.created_at)}</p>
          {e.remark && <p className="private-copy">{e.remark}</p>}
          <p className="payment-reference">Admin {e.actor_id}</p>
        </article>
      ))}
      <Pages
        base={`/admin/exceptions/${c.id}`}
        page={data.page}
        hasMore={data.has_more}
        input={input}
      />
    </>
  );
}

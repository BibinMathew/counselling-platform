import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { randomUUID } from "node:crypto";
import { readWorkspaceMode } from "@/lib/private-content/config";
import { getSession } from "@/modules/counselor-workspace/server";
import { sessionTime } from "@/modules/counselor-workspace/model";
import { loadNoteForEditor } from "@/modules/session-notes/server";
import { NoteEditor } from "@/modules/session-notes/editor";
export default function SessionPage({ params }: { params: Promise<{ bookingId: string }> }) {
  return (
    <div className="page-main catalog-page booking-page">
      <Link href="/counselor">Counselor area</Link>
      <Suspense fallback={<p>Loading session…</p>}>
        <Content params={params} />
      </Suspense>
    </div>
  );
}
async function Content({ params }: { params: Promise<{ bookingId: string }> }) {
  await connection();
  if (readWorkspaceMode(process.env) !== "local")
    return <p>Local session workspace is disabled.</p>;
  const value = await getSession((await params).bookingId);
  if (!value) notFound();
  const { profile, session } = value;
  let note: { body: string; version: number } | null = null;
  try {
    note = await loadNoteForEditor(profile.id, session.id);
  } catch {
    /* Safe unavailable state; never serialize crypto/service errors. */
  }
  return (
    <>
      <h1>Session details</h1>
      <p>Local development: use synthetic content only. Production use is disabled.</p>
      <h2>{session.customer_name}</h2>
      <p>
        {sessionTime(session.start_at)} – {sessionTime(session.end_at)} · Asia/Kolkata
      </p>
      <p>
        Confirmed
        {session.is_past ? " · Past appointment" : session.in_progress ? " · In progress" : ""}
      </p>
      {!session.is_past &&
        (session.meeting_url ? (
          <a
            href={session.meeting_url}
            target="_blank"
            rel="noopener noreferrer"
            referrerPolicy="no-referrer"
          >
            Join Meet
          </a>
        ) : (
          <p>Meeting link will follow.</p>
        ))}
      <h2>Confidential session note</h2>
      {note ? (
        <NoteEditor
          bookingId={session.id}
          body={note.body}
          version={note.version}
          requestId={randomUUID()}
        />
      ) : (
        <p>Private notes are unavailable.</p>
      )}
    </>
  );
}

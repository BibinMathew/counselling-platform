"use client";
import { useActionState, useEffect, useRef, useState } from "react";
import { savePrivateNote } from "./actions";
import { BEFORE_LEAVE_EVENT } from "@/lib/navigation-events";
import type { NoteActionState } from "./server";
export function NoteEditor({
  bookingId,
  body,
  version,
  requestId,
}: {
  bookingId: string;
  body: string;
  version: number;
  requestId: string;
}) {
  const [draft, setDraft] = useState(body);
  const [savedDraft, setSavedDraft] = useState(body);
  const allowExit = useRef(false);
  const dirty = draft !== savedDraft;
  useEffect(() => {
    if (!dirty) return;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (allowExit.current) return;
      event.preventDefault();
      event.returnValue = "";
    };
    const beforeNavigate = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      const link = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (
        !(link instanceof HTMLAnchorElement) ||
        link.download ||
        (link.target && link.target !== "_self")
      )
        return;
      const target = new URL(link.href, window.location.href);
      if (target.href === window.location.href) return;
      const current = new URL(window.location.href);
      if (
        target.hash &&
        target.origin === current.origin &&
        target.pathname === current.pathname &&
        target.search === current.search
      )
        return;
      if (!window.confirm("Discard your unsaved private note and leave this page?")) {
        event.preventDefault();
        event.stopPropagation();
      } else {
        allowExit.current = true;
      }
    };
    const beforeLeave = (event: Event) => {
      if (event.defaultPrevented) return;
      if (!window.confirm("Discard your unsaved private note and sign out?"))
        event.preventDefault();
      else allowExit.current = true;
    };
    window.addEventListener(BEFORE_LEAVE_EVENT, beforeLeave);
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", beforeNavigate, true);
    return () => {
      window.removeEventListener(BEFORE_LEAVE_EVENT, beforeLeave);
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("click", beforeNavigate, true);
    };
  }, [dirty]);
  const [expected, setExpected] = useState(version);
  const [request, setRequest] = useState(requestId);
  const [state, action, pending] = useActionState(
    async (previous: NoteActionState, form: FormData): Promise<NoteActionState> => {
      try {
        const result = await savePrivateNote(previous, form);
        if (result.status === "saved" && result.version !== undefined) {
          const submitted = String(form.get("body") ?? "");
          setSavedDraft(submitted.trim());
          setDraft((current) => (current === submitted ? submitted.trim() : current));
          setExpected(result.version);
          setRequest(crypto.randomUUID());
        }
        return result;
      } catch {
        return {
          status: "error",
          message: "Save unavailable. Your draft is kept; retry the same request.",
        };
      }
    },
    { status: "idle", message: "" },
  );
  return (
    <form action={action} className="note-editor booking-form">
      <input type="hidden" name="bookingId" value={bookingId} />
      <input type="hidden" name="expectedVersion" value={expected} />
      <input type="hidden" name="requestId" value={request} />
      <p>
        Saved version {expected}. Only your counselor account can read this note through the app.
      </p>
      <label htmlFor="private-session-note">Private session note</label>
      <textarea
        id="private-session-note"
        name="body"
        rows={10}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        aria-describedby="note-guidance"
      />
      <p id="note-guidance">
        Use fictional test content only. Maximum 20,000 characters. Notes are not automatically
        shared with customers, admins or other counselors.
      </p>
      <label className="note-ack">
        <input type="checkbox" name="acknowledged" /> I am using fictional test content only.
      </label>
      <button disabled={pending}>{pending ? "Saving…" : "Save private note"}</button>
      <p role="status">{state.message}</p>
      <button
        type="button"
        onClick={() => {
          if (window.confirm("Reload the saved note? This replaces your unsaved draft.")) {
            allowExit.current = true;
            window.location.reload();
          }
        }}
      >
        Reload saved note
      </button>
    </form>
  );
}

"use client";
import Link from "next/link";
import { useActionState, useId, useState } from "react";
import { useDraftGuard } from "@/components/draft-guard";
import { initialState, type FormState } from "@/modules/feedback/model";
import { openCase, updateCase } from "./actions";
export function CaseOpenForm({
  sourceType = "",
  sourceId = "",
}: {
  sourceType?: string;
  sourceId?: string;
}) {
  const fieldId = useId();
  const [type, setType] = useState(sourceType);
  const [id, setId] = useState(sourceId);
  const [remark, setRemark] = useState("");
  const [clean, setClean] = useState(false);
  const reload = useDraftGuard(!clean && (type !== sourceType || id !== sourceId || remark !== ""));
  const [state, action, pending] = useActionState(async (previous: FormState, form: FormData) => {
    try {
      const r = await openCase(previous, form);
      if (r.status === "saved") setClean(true);
      return r;
    } catch {
      return {
        status: "error",
        message: "Opening unavailable. Your draft is kept; retry the same source.",
      } as FormState;
    }
  }, initialState);
  return (
    <form
      action={action}
      onReset={(event) => event.preventDefault()}
      className="booking-form note-editor"
    >
      <fieldset disabled={pending} className="form-fields">
        <h2>Open an operational case</h2>
        <label htmlFor={`${fieldId}-type`}>Source type</label>
        <select
          id={`${fieldId}-type`}
          name="sourceType"
          value={type}
          onChange={(e) => {
            setType(e.target.value);
            setClean(false);
          }}
        >
          <option value="">Choose a source</option>
          {["booking", "payment_order", "payment_event", "notification_job"].map((t) => (
            <option key={t} value={t}>
              {t.replaceAll("_", " ")}
            </option>
          ))}
        </select>
        <label htmlFor={`${fieldId}-source`}>Source ID</label>
        <input
          id={`${fieldId}-source`}
          name="sourceId"
          value={id}
          onChange={(e) => {
            setId(e.target.value);
            setClean(false);
          }}
        />
        <Remark
          value={remark}
          setValue={(v) => {
            setRemark(v);
            setClean(false);
          }}
        />
        <Ack />
        <button disabled={pending}>{pending ? "Opening…" : "Open case"}</button>
        <p role="status">{state.message}</p>
        {state.id && <Link href={`/admin/exceptions/${state.id}`}>View case</Link>}
        <button type="button" onClick={reload}>
          Reload cases
        </button>
      </fieldset>
    </form>
  );
}
export function CaseEditor({
  caseId,
  version,
  status,
  requestId,
}: {
  caseId: string;
  version: number;
  status: string;
  requestId: string;
}) {
  const fieldId = useId();
  const [expected, setExpected] = useState(version);
  const [request, setRequest] = useState(requestId);
  const [remark, setRemark] = useState("");
  const [actionName, setActionName] = useState(
    status === "closed" ? "reopen" : status === "open" ? "start" : "close",
  );
  const [baseline, setBaseline] = useState({
    remark: "",
    action: status === "closed" ? "reopen" : status === "open" ? "start" : "close",
  });
  const reload = useDraftGuard(remark !== baseline.remark || actionName !== baseline.action);
  const [state, action, pending] = useActionState(async (previous: FormState, form: FormData) => {
    try {
      const r = await updateCase(previous, form);
      if (r.status === "saved" && r.version !== undefined) {
        setExpected(r.version);
        setRequest(crypto.randomUUID());
        const next =
          form.get("action") === "close"
            ? "reopen"
            : form.get("action") === "start"
              ? "close"
              : "start";
        const submitted = String(form.get("remark") ?? "");
        setRemark((current) => (current === submitted ? "" : current));
        setActionName(next);
        setBaseline({ remark: "", action: next });
      }
      return r;
    } catch {
      return {
        status: "error",
        message: "Update unavailable. Your draft is kept; retry the same request.",
      } as FormState;
    }
  }, initialState);
  return (
    <form
      action={action}
      onReset={(event) => event.preventDefault()}
      className="booking-form note-editor"
    >
      <fieldset disabled={pending} className="form-fields">
        <input type="hidden" name="caseId" value={caseId} />
        <input type="hidden" name="expectedVersion" value={expected} />
        <input type="hidden" name="requestId" value={request} />
        <label htmlFor={`${fieldId}-action`}>Case action</label>
        <select
          id={`${fieldId}-action`}
          name="action"
          value={actionName}
          onChange={(e) => setActionName(e.target.value)}
        >
          {status === "closed" ? (
            <option value="reopen">Reopen</option>
          ) : (
            <>
              {status !== "in_progress" && <option value="start">Start follow-up</option>}
              {status !== "open" && <option value="reset">Return to Open</option>}
              <option value="close">Close administrative follow-up</option>
            </>
          )}
        </select>
        <Remark value={remark} setValue={setRemark} />
        <p>
          Closing or reopening requires a remark. Closing does not change the booking, payment,
          notification or source issue queue.
        </p>
        <Ack key={expected} />
        <button disabled={pending}>{pending ? "Updating…" : "Update case"}</button>
        <p role="status">{state.message}</p>
        <button type="button" onClick={reload}>
          Reload case
        </button>
      </fieldset>
    </form>
  );
}
function Remark({ value, setValue }: { value: string; setValue: (v: string) => void }) {
  const fieldId = useId();
  return (
    <>
      <label htmlFor={fieldId}>Operational remark</label>
      <textarea
        id={fieldId}
        name="remark"
        rows={5}
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      <p>
        Maximum 1,000 characters. Fictional operational facts only; no clinical, contact, credential
        or payment instrument data.
      </p>
    </>
  );
}
function Ack() {
  return (
    <label className="note-ack">
      <input type="checkbox" name="acknowledged" /> I am using fictional test content only.
    </label>
  );
}

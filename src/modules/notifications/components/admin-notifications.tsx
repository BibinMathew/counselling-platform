"use client";
import { useActionState } from "react";
import { notificationAction } from "../actions";
export function NotificationControl({
  operation,
  jobId,
  label,
}: {
  operation: "run" | "retry" | "fail";
  jobId?: string;
  label: string;
}) {
  const [state, action, pending] = useActionState(notificationAction, { message: "" });
  return (
    <form action={action} className="payment-controls">
      <input type="hidden" name="operation" value={operation} />
      {jobId && <input type="hidden" name="jobId" value={jobId} />}
      <button disabled={pending}>{label}</button>
      <p role="status">{state.message}</p>
    </form>
  );
}

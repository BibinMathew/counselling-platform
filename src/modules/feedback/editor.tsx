"use client";
import { useActionState, useId, useState } from "react";
import { submitFeedback, reviewFeedback } from "./actions";
import { initialState, type FormState } from "./model";
import { useDraftGuard } from "@/components/draft-guard";
export function FeedbackEditor({ bookingId }: { bookingId: string }) {
  const fieldId = useId();
  const [rating, setRating] = useState("");
  const [comment, setComment] = useState("");
  const [clean, setClean] = useState(false);
  const reload = useDraftGuard(!clean && (rating !== "" || comment !== ""));
  const [state, action, pending] = useActionState(async (previous: FormState, form: FormData) => {
    try {
      const r = await submitFeedback(previous, form);
      if (r.status === "saved" || r.status === "existing") setClean(true);
      return r;
    } catch {
      return {
        status: "error",
        message: "Feedback save unavailable. Your draft is kept; retry or reload your receipt.",
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
        <input type="hidden" name="bookingId" value={bookingId} />
        <p>Only platform admins and you can read your feedback. Use fictional content only.</p>
        <label htmlFor={`${fieldId}-rating`}>Rating</label>
        <select
          id={`${fieldId}-rating`}
          name="rating"
          value={rating}
          onChange={(e) => {
            setRating(e.target.value);
            setClean(false);
          }}
        >
          <option value="">Choose 1–5 stars</option>
          {[1, 2, 3, 4, 5].map((n) => (
            <option key={n} value={n}>
              {n} {n === 1 ? "star" : "stars"}
            </option>
          ))}
        </select>
        <label htmlFor={`${fieldId}-comment`}>Optional feedback</label>
        <textarea
          id={`${fieldId}-comment`}
          name="comment"
          rows={6}
          value={comment}
          onChange={(e) => {
            setComment(e.target.value);
            setClean(false);
          }}
        />
        <p>
          Maximum 2,000 characters. Do not enter real counseling details or contact information.
          Feedback can be submitted once per appointment.
        </p>
        <label className="note-ack">
          <input type="checkbox" name="acknowledged" /> I am using fictional test content only.
        </label>
        {!clean && (
          <button disabled={pending}>{pending ? "Submitting…" : "Submit private feedback"}</button>
        )}
        <p role="status">{state.message}</p>
        <button type="button" onClick={reload}>
          Reload receipt
        </button>
      </fieldset>
    </form>
  );
}
export function FeedbackReview({ id }: { id: string }) {
  const [state, action, pending] = useActionState(reviewFeedback, initialState);
  return (
    <form action={action}>
      <input type="hidden" name="feedbackId" value={id} />
      <button disabled={pending || state.status === "saved"}>
        {pending ? "Acknowledging…" : "Acknowledge review"}
      </button>
      <p role="status">{state.message}</p>
    </form>
  );
}

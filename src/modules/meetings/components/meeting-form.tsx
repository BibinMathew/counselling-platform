"use client";
import { useActionState } from "react";
import { saveMeeting } from "../actions";
export function MeetingForm({ bookingId, url }: { bookingId: string; url: string | null }) {
  const [state, action, pending] = useActionState(saveMeeting, { message: "" });
  return (
    <form action={action} className="operations-form booking-form">
      <input type="hidden" name="bookingId" value={bookingId} />
      <label htmlFor={`meet-${bookingId}`}>Google Meet link</label>
      <input
        id={`meet-${bookingId}`}
        name="meetingUrl"
        type="url"
        required
        defaultValue={url ?? ""}
        placeholder="https://meet.google.com/abc-defg-hij"
      />
      <button disabled={pending}>{pending ? "Saving…" : "Save meeting link"}</button>
      <p role="status">{state.message}</p>
    </form>
  );
}

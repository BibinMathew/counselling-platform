"use client";

import { useActionState } from "react";
import {
  saveHoldSettings,
  submitBooking,
  type BookingActionState,
} from "@/modules/booking/actions";

const initialState: BookingActionState = { status: "idle", message: "" };

export function BookingForm({
  counselor,
  start,
  reschedule,
}: {
  counselor: string;
  start: string;
  reschedule?: string;
}) {
  const [state, action, pending] = useActionState(submitBooking, initialState);
  return (
    <form action={action} className="booking-form">
      <input type="hidden" name="counselor" value={counselor} />
      <input type="hidden" name="start" value={start} />
      <input type="hidden" name="reschedule" value={reschedule ?? ""} />
      <button disabled={pending}>
        {pending ? "Saving..." : reschedule ? "Reschedule appointment" : "Hold this time"}
      </button>
      {state.message && <p role="alert">{state.message}</p>}
    </form>
  );
}

export function HoldSettingsForm({ minutes }: { minutes: number }) {
  const [state, action, pending] = useActionState(saveHoldSettings, initialState);
  return (
    <form action={action} className="availability-form">
      <label>
        Hold duration (minutes)
        <input name="holdMinutes" type="number" min="1" max="60" defaultValue={minutes} required />
      </label>
      <button disabled={pending}>{pending ? "Saving..." : "Save hold duration"}</button>
      {state.message && <p role={state.status === "error" ? "alert" : "status"}>{state.message}</p>}
    </form>
  );
}

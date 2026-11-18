"use client";

import { useActionState } from "react";
import { completeContactEmail, type IdentityActionState } from "@/modules/identity/actions";

const initialState: IdentityActionState = { status: "idle", message: "" };

export function ContactEmailForm({ next }: { next?: string | null }) {
  const [state, action, pending] = useActionState(completeContactEmail, initialState);

  if (state.status === "success") {
    return (
      <p role="status">
        {state.message}{" "}
        <a href={next ?? "/profile"}>
          {next ? "Continue to selected time" : "Continue to profile"}
        </a>
      </p>
    );
  }

  return (
    <form action={action}>
      <input type="hidden" name="next" value={next ?? ""} />
      <label htmlFor="contactEmail">Email address</label>
      <input
        id="contactEmail"
        name="email"
        type="email"
        autoComplete="email"
        maxLength={254}
        required
      />
      <button type="submit" disabled={pending}>
        {pending ? "Saving..." : "Continue"}
      </button>
      {state.message && <p role={state.status === "error" ? "alert" : "status"}>{state.message}</p>}
    </form>
  );
}

"use client";

import { useActionState } from "react";
import { updateOwnProfile, type IdentityActionState } from "@/modules/identity/actions";

const initialState: IdentityActionState = { status: "idle", message: "" };

export function ProfileForm({ preferredName }: { preferredName: string }) {
  const [state, action, pending] = useActionState(updateOwnProfile, initialState);

  return (
    <form action={action}>
      <label htmlFor="preferredName">Preferred name</label>
      <input
        id="preferredName"
        name="preferredName"
        autoComplete="nickname"
        maxLength={80}
        defaultValue={preferredName}
        required
      />
      <button type="submit" disabled={pending}>
        {pending ? "Saving..." : "Save profile"}
      </button>
      {state.message && <p role={state.status === "error" ? "alert" : "status"}>{state.message}</p>}
    </form>
  );
}

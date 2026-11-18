"use client";

import { useActionState } from "react";
import { assignProfileRole, type IdentityActionState } from "@/modules/identity/actions";

const initialState: IdentityActionState = { status: "idle", message: "" };

export function RoleAssignmentForm() {
  const [state, action, pending] = useActionState(assignProfileRole, initialState);

  return (
    <form action={action}>
      <label htmlFor="targetUserId">Authenticated account ID</label>
      <input id="targetUserId" name="targetUserId" autoComplete="off" required />
      <label htmlFor="role">Role</label>
      <select id="role" name="role" defaultValue="customer">
        <option value="customer">Customer</option>
        <option value="counselor">Counselor</option>
        <option value="admin">Admin</option>
      </select>
      <label htmlFor="reason">Reason for role change</label>
      <textarea id="reason" name="reason" minLength={10} maxLength={500} required />
      <label htmlFor="verificationReference">Counselor verification reference</label>
      <input
        id="verificationReference"
        name="verificationReference"
        maxLength={120}
        autoComplete="off"
      />
      <p>
        For counselor access, enter an opaque verification record ID. Do not enter identity
        documents or sensitive details.
      </p>
      <button type="submit" disabled={pending}>
        {pending ? "Recording..." : "Assign role"}
      </button>
      {state.message && <p role={state.status === "error" ? "alert" : "status"}>{state.message}</p>}
    </form>
  );
}

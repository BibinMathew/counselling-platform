"use client";

import { useActionState } from "react";
import {
  requestPhoneOtp,
  verifyPhoneOtp,
  type IdentityActionState,
} from "@/modules/identity/actions";

const initialState: IdentityActionState = { status: "idle", message: "" };

export function LoginForm() {
  const [requestState, requestAction, requestPending] = useActionState(
    requestPhoneOtp,
    initialState,
  );
  const [verifyState, verifyAction, verifyPending] = useActionState(verifyPhoneOtp, initialState);

  return (
    <section>
      {requestState.status !== "otp_sent" ? (
        <form action={requestAction}>
          <label htmlFor="preferredName">Preferred name (optional)</label>
          <input id="preferredName" name="preferredName" autoComplete="nickname" maxLength={80} />

          <label htmlFor="phone">Indian mobile number</label>
          <input
            id="phone"
            name="phone"
            type="tel"
            autoComplete="tel-national"
            inputMode="tel"
            placeholder="+91 98765 43210"
            required
          />

          <label>
            <input name="adultConfirmed" type="checkbox" aria-required="true" /> I confirm that I am
            18 or older.
          </label>
          <p>
            Accounts for minors are unavailable. This temporary confirmation does not verify age.
          </p>

          <button type="submit" disabled={requestPending}>
            {requestPending ? "Requesting code..." : "Continue"}
          </button>
          {requestState.message && <p role="status">{requestState.message}</p>}
        </form>
      ) : (
        <>
          <p role="status">{requestState.message}</p>
          <form action={verifyAction}>
            <input name="phone" type="hidden" value={requestState.phone} />
            <input name="preferredName" type="hidden" value={requestState.preferredName ?? ""} />
            <label htmlFor="otp">One-time code</label>
            <input
              id="otp"
              name="otp"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              required
            />
            <button type="submit" disabled={verifyPending}>
              {verifyPending ? "Verifying..." : "Verify code"}
            </button>
            {verifyState.message && <p role="alert">{verifyState.message}</p>}
          </form>
        </>
      )}
    </section>
  );
}
